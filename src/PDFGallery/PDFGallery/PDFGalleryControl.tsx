import * as React from "react";
import { Pivot, PivotItem, IPivotItemProps } from "@fluentui/react/lib/Pivot";
import { DefaultButton, IconButton } from "@fluentui/react/lib/Button";
import { Spinner, SpinnerSize } from "@fluentui/react/lib/Spinner";
import { MessageBar, MessageBarType } from "@fluentui/react/lib/MessageBar";
import { TooltipHost } from "@fluentui/react/lib/Tooltip";
import { Icon } from "@fluentui/react/lib/Icon";
import { TEST_MODE_DOCUMENTS, TEST_MODE_PDF_BASE64 } from "./TestModeData";

export interface IPDFGalleryControlProps {
  dataset: ComponentFramework.PropertyTypes.DataSet;
  fileColumnName: string;
  tabLabelColumnName?: string;
  allowDownload: boolean;
  showButtonLabels: boolean;
  tabLabelMaxChars: number;
  allowOpenRecord: boolean;
  layoutStyle: "Horizontal" | "Vertical";
  webAPI: ComponentFramework.WebApi;
  navigation: ComponentFramework.Navigation;
  isTestMode: boolean;
}

interface IDocMeta {
  status: "loading" | "ready" | "error";
  label?: string;
  fileName?: string;
  error?: string;
}

function truncateLabel(label: string, maxChars: number): string {
  return maxChars > 0 && label.length > maxChars ? `${label.slice(0, maxChars)}…` : label;
}

interface IActionButtonProps {
  iconName: string;
  label: string;
  showLabel: boolean;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

const ActionButton = ({ iconName, label, showLabel, onClick, disabled, disabledReason }: IActionButtonProps): React.ReactElement => {
  const tooltipText = disabled && disabledReason ? disabledReason : label;
  if (showLabel) {
    return (
      <TooltipHost content={disabled ? tooltipText : undefined}>
        <DefaultButton className="pdfgallery-action-button" text={label} iconProps={{ iconName }} onClick={onClick} disabled={disabled} />
      </TooltipHost>
    );
  }
  return (
    <TooltipHost content={tooltipText}>
      <IconButton className="pdfgallery-action-button" iconProps={{ iconName }} onClick={onClick} ariaLabel={label} disabled={disabled} />
    </TooltipHost>
  );
};

const PDF_SIGNATURE = "%PDF-";

function isPdfSignature(buffer: ArrayBuffer): boolean {
  const header = new Uint8Array(buffer.slice(0, PDF_SIGNATURE.length));
  let text = "";
  for (const byte of header) {
    text += String.fromCharCode(byte);
  }
  return text === PDF_SIGNATURE;
}

interface IFetchedFile {
  blob: Blob;
  isPdf: boolean;
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

async function fetchPdfBytes(entitySetName: string, recordId: string, fileColumnName: string): Promise<IFetchedFile> {
  const url = `/api/data/v9.2/${entitySetName}(${recordId})/${fileColumnName}/$value`;
  const response = await fetch(url, { headers: { Accept: "application/octet-stream" } });
  if (!response.ok) {
    throw new Error(`Failed to download file (${response.status} ${response.statusText})`);
  }
  // Dataverse's $value endpoint responds with Content-Type: application/octet-stream regardless of
  // the underlying file type, which response.blob() would otherwise carry over to the Blob's own
  // type. An untyped/octet-stream blob won't render inline in an <iframe> or window.open - the
  // browser downloads it instead - so the MIME type is forced here rather than trusting the response.
  // This control assumes fileColumnName only ever holds PDFs, but nothing enforces that in Dataverse,
  // so the fetched bytes are sniffed for the "%PDF-" signature before being treated as one - a
  // non-PDF file still downloads correctly, it's just not offered for inline preview.
  const buffer = await response.arrayBuffer();
  const isPdf = isPdfSignature(buffer);
  return { blob: new Blob([buffer], { type: isPdf ? "application/pdf" : "application/octet-stream" }), isPdf };
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
  showButtonLabels,
  tabLabelMaxChars,
  allowOpenRecord,
  layoutStyle,
  webAPI,
  navigation,
  isTestMode,
}: IPDFGalleryControlProps): React.ReactElement => {
  const entityLogicalName = dataset.getTargetEntityType();

  const sortedRecordIds = isTestMode
    ? TEST_MODE_DOCUMENTS.map((d) => d.id)
    : dataset.loading
      ? []
      : dataset.sortedRecordIds ?? [];
  const recordIdsKey = sortedRecordIds.join(",");

  // The dataset only hands us whichever page(s) have been loaded so far - context.parameters.documents
  // reflects the subgrid's page size (often small, e.g. 4-5), not every related record. Since this
  // control has no pagination UI of its own, keep requesting more pages until there's nothing left,
  // so every related document shows up regardless of the subgrid's configured page size.
  React.useEffect(() => {
    if (isTestMode) return;
    if (!dataset.loading && dataset.paging.hasNextPage) {
      dataset.paging.loadNextPage();
    }
  }, [isTestMode, dataset.loading, dataset.paging.hasNextPage]);

  const [docMeta, setDocMeta] = React.useState<Record<string, IDocMeta>>({});
  const docMetaRef = React.useRef<Record<string, IDocMeta>>({});
  docMetaRef.current = docMeta;

  const [selectedId, setSelectedId] = React.useState<string | undefined>(undefined);

  const [entitySetName, setEntitySetName] = React.useState<string | undefined>(undefined);
  const [entitySetError, setEntitySetError] = React.useState<string | undefined>(undefined);

  const [bytesState, setBytesState] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
  const [bytesError, setBytesError] = React.useState<string | undefined>(undefined);
  const [blobUrl, setBlobUrl] = React.useState<string | undefined>(undefined);
  const [isPdf, setIsPdf] = React.useState<boolean>(true);
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
      ? Promise.resolve<IFetchedFile>({ blob: base64ToBlob(TEST_MODE_PDF_BASE64, "application/pdf"), isPdf: true })
      : fetchPdfBytes(entitySetName as string, selectedId, fileColumnName);

    loadBytes
      .then(({ blob, isPdf: fetchedIsPdf }) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
        setIsPdf(fetchedIsPdf);
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

  const handleOpenRecord = (): void => {
    if (!selectedId) return;
    navigation.openForm({ entityName: entityLogicalName, entityId: selectedId }).catch((err: Error) => {
      console.error("Failed to open record", err);
    });
  };

  const isVertical = layoutStyle === "Vertical";

  const actionButtons = selectedId && (
    <div className="pdfgallery-toolbar-actions">
      {allowOpenRecord && <ActionButton iconName="Forward" label="Open Record" showLabel={showButtonLabels} onClick={handleOpenRecord} />}
      {blobUrl && bytesState === "ready" && (
        <>
          <ActionButton
            iconName="OpenInNewWindow"
            label="Open in new tab"
            showLabel={showButtonLabels}
            disabled={!isPdf}
            disabledReason="Only PDF files can be opened this way - use Download instead"
            onClick={() => window.open(blobUrl, "_blank", "noopener,noreferrer")}
          />
          {allowDownload && (
            <ActionButton
              iconName="Download"
              label="Download"
              showLabel={showButtonLabels}
              onClick={() => triggerDownload(blobUrl, currentFileName as string)}
            />
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="pdfgallery-root">
      <div className="pdfgallery-toolbar">
        {!isVertical && (
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
              const fullLabel = meta?.status === "ready" ? meta.label ?? id : meta?.status === "error" ? "⚠ Error" : "Loading…";
              const headerText = truncateLabel(fullLabel, tabLabelMaxChars);
              return (
                <PivotItem
                  headerText={headerText}
                  itemKey={id}
                  key={id}
                  onRenderItemLink={(linkProps?: IPivotItemProps, defaultRenderer?: (props?: IPivotItemProps) => React.ReactElement | null) =>
                    defaultRenderer ? <span title={fullLabel}>{defaultRenderer(linkProps)}</span> : null
                  }
                />
              );
            })}
          </Pivot>
        )}
        {actionButtons}
      </div>

      <div className={isVertical ? "pdfgallery-body pdfgallery-body-vertical" : "pdfgallery-body"}>
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
            {bytesState === "ready" && blobUrl && isPdf && (
              // The #view=FitH PDF Open Parameter forces the browser's built-in viewer to fit the
              // page to the frame's width. Without it, "Automatic" zoom is used, which doesn't
              // reliably fit-to-width when the PDF's actual page size (e.g. US Letter) doesn't
              // match our fixed A4-shaped frame, leaving the page looking zoomed in and cropped.
              <iframe key={blobUrl} title={currentLabel} src={`${blobUrl}#view=FitH`} className="pdfgallery-iframe" />
            )}
            {bytesState === "ready" && blobUrl && !isPdf && (
              <div className="pdfgallery-centered pdfgallery-unsupported">
                <Icon iconName="Info" className="pdfgallery-unsupported-icon" />
                <span>This file can&apos;t be previewed here - only PDF files are supported. Use Download to save it.</span>
              </div>
            )}
          </div>
        </div>

        {isVertical && (
          <div className="pdfgallery-sidebar" role="tablist" aria-orientation="vertical">
            {sortedRecordIds.map((id) => {
              const meta = docMeta[id];
              const fullLabel = meta?.status === "ready" ? meta.label ?? id : meta?.status === "error" ? "⚠ Error" : "Loading…";
              // Unlike the horizontal tab strip, the sidebar's width is flexible, so truncation is
              // left to CSS text-overflow (which adapts to the space actually available) rather than
              // the fixed tabLabelMaxChars character count.
              const headerText = fullLabel;
              const isSelected = id === selectedId;
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  key={id}
                  title={fullLabel}
                  className={isSelected ? "pdfgallery-sidebar-item is-selected" : "pdfgallery-sidebar-item"}
                  onClick={() => setSelectedId(id)}
                >
                  {headerText}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
