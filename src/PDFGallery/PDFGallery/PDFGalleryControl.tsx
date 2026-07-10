import * as React from "react";
import { Pivot, PivotItem } from "@fluentui/react/lib/Pivot";
import { DefaultButton } from "@fluentui/react/lib/Button";
import { Spinner, SpinnerSize } from "@fluentui/react/lib/Spinner";
import { MessageBar, MessageBarType } from "@fluentui/react/lib/MessageBar";
import { TEST_MODE_DOCUMENTS, TEST_MODE_PDF_BASE64 } from "./TestModeData";

export interface IPDFGalleryControlProps {
  dataset: ComponentFramework.PropertyTypes.DataSet;
  fileColumnName: string;
  tabLabelColumnName?: string;
  allowDownload: boolean;
  webAPI: ComponentFramework.WebApi;
  isTestMode: boolean;
}

interface IDocMeta {
  status: "loading" | "ready" | "error";
  label?: string;
  fileName?: string;
  error?: string;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array<number>(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

async function resolveEntitySetName(entityLogicalName: string): Promise<string> {
  const url = `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')?$select=EntitySetName`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Failed to resolve entity set name (${response.status} ${response.statusText})`);
  }
  const data = (await response.json()) as { EntitySetName: string };
  return data.EntitySetName;
}

async function fetchPdfBytes(entitySetName: string, recordId: string, fileColumnName: string): Promise<Blob> {
  const url = `/api/data/v9.2/${entitySetName}(${recordId})/${fileColumnName}/$value`;
  const response = await fetch(url, { headers: { Accept: "application/octet-stream" } });
  if (!response.ok) {
    throw new Error(`Failed to download file (${response.status} ${response.statusText})`);
  }
  return response.blob();
}

function triggerDownload(url: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "document.pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const PDFGalleryControl = ({
  dataset,
  fileColumnName,
  tabLabelColumnName,
  allowDownload,
  webAPI,
  isTestMode,
}: IPDFGalleryControlProps): React.ReactElement => {
  const entityLogicalName = dataset.getTargetEntityType();

  const sortedRecordIds = isTestMode
    ? TEST_MODE_DOCUMENTS.map((d) => d.id)
    : dataset.loading
      ? []
      : dataset.sortedRecordIds ?? [];
  const recordIdsKey = sortedRecordIds.join(",");

  const [docMeta, setDocMeta] = React.useState<Record<string, IDocMeta>>({});
  const docMetaRef = React.useRef<Record<string, IDocMeta>>({});
  docMetaRef.current = docMeta;

  const [selectedId, setSelectedId] = React.useState<string | undefined>(undefined);

  const [entitySetName, setEntitySetName] = React.useState<string | undefined>(undefined);
  const [entitySetError, setEntitySetError] = React.useState<string | undefined>(undefined);

  const [bytesState, setBytesState] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
  const [bytesError, setBytesError] = React.useState<string | undefined>(undefined);
  const [blobUrl, setBlobUrl] = React.useState<string | undefined>(undefined);
  const blobUrlRef = React.useRef<string | undefined>(undefined);

  // Resolve the entity set name once (needed for the raw $value fetch below); not needed in test mode.
  React.useEffect(() => {
    if (isTestMode) return;
    let cancelled = false;
    resolveEntitySetName(entityLogicalName)
      .then((name) => {
        if (!cancelled) setEntitySetName(name);
        return;
      })
      .catch((err: Error) => {
        if (!cancelled) setEntitySetError(err.message ?? "Failed to resolve entity metadata");
      });
    return () => {
      cancelled = true;
    };
  }, [entityLogicalName, isTestMode]);

  // Fetch the tab label + real file name per record. File columns don't expose either through the
  // dataset's own column values, so both come from a dedicated per-record retrieveRecord call.
  React.useEffect(() => {
    if (isTestMode) {
      const meta: Record<string, IDocMeta> = {};
      TEST_MODE_DOCUMENTS.forEach((d) => {
        meta[d.id] = { status: "ready", label: d.fileName, fileName: d.fileName };
      });
      setDocMeta(meta);
      return;
    }

    const idsNeedingFetch = sortedRecordIds.filter((id) => !docMetaRef.current[id]);
    if (idsNeedingFetch.length === 0) return;

    const fileNameColumn = `${fileColumnName}_name`;
    const selectCols =
      tabLabelColumnName && tabLabelColumnName !== fileNameColumn
        ? `${tabLabelColumnName},${fileNameColumn}`
        : fileNameColumn;

    setDocMeta((prev) => {
      const next = { ...prev };
      idsNeedingFetch.forEach((id) => {
        next[id] = { status: "loading" };
      });
      return next;
    });

    idsNeedingFetch.forEach((id) => {
      webAPI
        .retrieveRecord(entityLogicalName, id, `?$select=${selectCols}`)
        .then((record) => {
          const recordAny = record as unknown as Record<string, string>;
          const fileName = recordAny[fileNameColumn] ?? "Document.pdf";
          const label = tabLabelColumnName ? recordAny[tabLabelColumnName] ?? fileName : fileName;
          setDocMeta((prev) => ({ ...prev, [id]: { status: "ready", label, fileName } }));
          return;
        })
        .catch((err: Error) => {
          setDocMeta((prev) => ({ ...prev, [id]: { status: "error", error: err.message ?? "Failed to load document info" } }));
        });
    });
  }, [recordIdsKey, isTestMode]);

  // Default/repair the selected tab whenever the set of records changes.
  React.useEffect(() => {
    if (sortedRecordIds.length === 0) {
      setSelectedId(undefined);
    } else if (!selectedId || !sortedRecordIds.includes(selectedId)) {
      setSelectedId(sortedRecordIds[0]);
    }
  }, [recordIdsKey]);

  // Fetch the PDF bytes for whichever tab is selected, on demand. Only one blob is ever held at a
  // time - the previous tab's object URL is revoked as soon as we move on, to avoid memory buildup.
  React.useEffect(() => {
    if (!selectedId) return;
    if (!isTestMode && !entitySetName) return;

    let cancelled = false;
    setBytesState("loading");
    setBytesError(undefined);

    const loadBytes = isTestMode
      ? Promise.resolve(base64ToBlob(TEST_MODE_PDF_BASE64, "application/pdf"))
      : fetchPdfBytes(entitySetName as string, selectedId, fileColumnName);

    loadBytes
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
        setBytesState("ready");
        return;
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setBytesState("error");
        setBytesError(err.message ?? "Failed to load PDF");
      });

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = undefined;
      }
      setBlobUrl(undefined);
    };
  }, [selectedId, entitySetName, isTestMode, fileColumnName]);

  if (!isTestMode && dataset.loading) {
    return (
      <div className="pdfgallery-root pdfgallery-centered">
        <Spinner label="Loading documents…" />
      </div>
    );
  }

  if (sortedRecordIds.length === 0) {
    return (
      <div className="pdfgallery-root pdfgallery-centered">
        <div className="pdfgallery-empty">No documents available.</div>
      </div>
    );
  }

  const currentMeta = selectedId ? docMeta[selectedId] : undefined;
  const currentLabel = currentMeta?.status === "ready" ? currentMeta.label : "Document";
  const currentFileName = currentMeta?.status === "ready" ? currentMeta.fileName ?? "document.pdf" : "document.pdf";

  return (
    <div className="pdfgallery-root">
      <div className="pdfgallery-toolbar">
        <Pivot
          className="pdfgallery-pivot"
          selectedKey={selectedId}
          overflowBehavior="menu"
          overflowAriaLabel="More documents"
          onLinkClick={(item) => {
            if (item?.props.itemKey) setSelectedId(item.props.itemKey);
          }}
        >
          {sortedRecordIds.map((id) => {
            const meta = docMeta[id];
            const headerText = meta?.status === "ready" ? meta.label ?? id : meta?.status === "error" ? "⚠ Error" : "Loading…";
            return <PivotItem headerText={headerText} itemKey={id} key={id} />;
          })}
        </Pivot>
        {blobUrl && bytesState === "ready" && (
          <div className="pdfgallery-toolbar-actions">
            <DefaultButton
              className="pdfgallery-action-button"
              text="Open in new tab"
              iconProps={{ iconName: "OpenInNewWindow" }}
              onClick={() => window.open(blobUrl, "_blank", "noopener,noreferrer")}
            />
            {allowDownload && (
              <DefaultButton
                className="pdfgallery-action-button"
                text="Download"
                iconProps={{ iconName: "Download" }}
                onClick={() => triggerDownload(blobUrl, currentFileName as string)}
              />
            )}
          </div>
        )}
      </div>

      <div className="pdfgallery-preview-area">
        <div className="pdfgallery-page">
          {entitySetError && <MessageBar messageBarType={MessageBarType.error}>{entitySetError}</MessageBar>}
          {bytesState === "loading" && (
            <div className="pdfgallery-centered">
              <Spinner label="Loading document…" size={SpinnerSize.large} />
            </div>
          )}
          {bytesState === "error" && (
            <div className="pdfgallery-centered">
              <MessageBar messageBarType={MessageBarType.error}>{bytesError}</MessageBar>
            </div>
          )}
          {bytesState === "ready" && blobUrl && (
            <iframe key={blobUrl} title={currentLabel} src={blobUrl} className="pdfgallery-iframe" />
          )}
        </div>
      </div>
    </div>
  );
};
