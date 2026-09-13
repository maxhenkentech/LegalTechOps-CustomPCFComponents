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
  // Semicolon-separated fallback chain - "lops_signedpdf;lops_draftpdf;lops_externalurl" tries
  // lops_signedpdf first, falls through to lops_draftpdf if that record's value there is blank, and
  // so on. A single name (no semicolon) behaves exactly as before. See parseColumnList and
  // resolveColumnKinds - each candidate can independently be a Dataverse File column or a text/URL
  // column, the two are resolved and mixed freely in one chain.
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

// Which candidate column actually won the fallback chain for a given record, and what it takes to
// preview it. "file" candidates go through the existing $value byte-fetch flow; "url" candidates
// are a whole new preview path (see resolveUrlSource).
interface IResolvedSource {
  kind: "file" | "url";
  columnName: string;
  fileName?: string; // file-kind only - the file's own name, from the <col>_name companion column
  url?: string; // url-kind only - normalized (scheme-prefixed) URL
}

interface IDocMeta {
  status: "loading" | "ready" | "empty" | "error";
  label?: string;
  fileName?: string;
  error?: string;
  source?: IResolvedSource;
}

function truncateLabel(label: string, maxChars: number): string {
  return maxChars > 0 && label.length > maxChars ? `${label.slice(0, maxChars)}…` : label;
}

// Shared fallback-chain syntax, same delimiter/semantics AdvancedLookUp uses for its Icon/Tooltip/
// Label Column properties: semicolon-separated, tried in order, first non-empty wins on a given
// record. Comma is deliberately not used - it means something different elsewhere in this repo
// (AdvancedLookUp's searchColumns unions every listed column instead of prioritizing them).
function parseColumnList(value: string): string[] {
  return (value || "")
    .split(";")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

type ColumnKind = "file" | "text" | "unsupported";

// AttributeTypeName distinguishes a File column from an Image column - both otherwise report
// AttributeType "Virtual" ambiguously, the same distinction RelationshipView and AdvancedLookUp make
// for the same reason. Anything that is not recognized as either File or a plain text/multiline
// column is "unsupported" - it is silently skipped when resolving a record's winning candidate
// (never wins, falls through to the next entry) rather than thrown, since a maker could point a
// stray candidate at, say, a Whole Number column by mistake.
async function resolveColumnKinds(entityLogicalName: string, columns: string[]): Promise<Record<string, ColumnKind>> {
  const result: Record<string, ColumnKind> = {};
  columns.forEach((c) => {
    result[c] = "unsupported";
  });
  if (columns.length === 0) return result;

  const filter = columns.map((c) => `LogicalName eq '${c}'`).join(" or ");
  const url = `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes?$select=LogicalName,AttributeType,AttributeTypeName&$filter=${filter}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Failed to resolve column metadata (${response.status} ${response.statusText})`);
  }
  const data = (await response.json()) as {
    value: { LogicalName: string; AttributeType: string; AttributeTypeName?: { Value: string } }[];
  };
  data.value.forEach((a) => {
    if (a.AttributeTypeName?.Value === "FileType") {
      result[a.LogicalName] = "file";
    } else if (a.AttributeType === "String" || a.AttributeType === "Memo") {
      result[a.LogicalName] = "text";
    }
  });
  return result;
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

// A bare "example.com/doc.pdf" with no scheme is a common data-entry mistake for a URL held in a
// plain text column - assume https rather than silently failing to load anything.
function normalizeUrl(value: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
}

function looksLikePdfUrl(url: string): boolean {
  return /\.pdf(?:[?#].*)?$/i.test(url);
}

function deriveNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
    return lastSegment ? decodeURIComponent(lastSegment) : parsed.hostname;
  } catch {
    return url;
  }
}

function urlHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

type UrlSourceMode = "pdf-blob" | "pdf-remote" | "webpage";

interface IUrlSourceResolution {
  mode: UrlSourceMode;
  blob?: Blob;
}

// Figures out how to preview a URL-based source. Fetches the URL once to sniff whether it is really
// a PDF - extension, Content-Type header, and the "%PDF-" byte signature each disagree with reality
// often enough on their own (e.g. an extensionless SharePoint download link) that no single check is
// trusted alone - and, if so, grabs the bytes for the same blob-URL preview flow the File-column path
// already uses. A fetch failure here almost always means the remote host's CORS policy does not allow
// reading the response from this origin, not that the resource is missing - in that case we cannot
// inspect it at all, so we fall back to the URL's own extension as a best guess: something that looks
// like a PDF still gets pointed at directly as an iframe src (many endpoints that block fetch() via
// CORS do not also block framing, since that is a different response header), otherwise it is treated
// as a regular webpage.
async function resolveUrlSource(url: string): Promise<IUrlSourceResolution> {
  const extensionSaysPdf = looksLikePdfUrl(url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed (${response.status} ${response.statusText})`);
    }
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const buffer = await response.arrayBuffer();
    const isPdf = extensionSaysPdf || contentType.includes("pdf") || isPdfSignature(buffer);
    return isPdf ? { mode: "pdf-blob", blob: new Blob([buffer], { type: "application/pdf" }) } : { mode: "webpage" };
  } catch {
    return extensionSaysPdf ? { mode: "pdf-remote" } : { mode: "webpage" };
  }
}

function triggerDownload(url: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "document.pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

type PreviewMode = "loading" | "error" | "empty" | "unsupported-file" | "pdf-blob" | "pdf-remote" | "webpage";

interface IPreviewState {
  mode: PreviewMode;
  error?: string;
  displaySrc?: string; // iframe src - a blob: URL (pdf-blob) or the remote URL itself (pdf-remote/webpage)
  openUrl?: string; // target for the "Open in new tab" action, when available
  downloadUrl?: string; // target for a real Download - only ever a blob: URL, since a cross-origin
  // remote URL cannot be forced to save via the download attribute
}

// What the toolbar's Open/Download buttons should do for a given preview state - and, when an
// action is not possible, why (shown as the button's disabled tooltip instead of just hiding it,
// matching this control's existing "explain, don't just disappear" pattern for the non-PDF File
// column case).
interface IActionAvailability {
  openUrl?: string;
  openDisabledReason?: string;
  downloadUrl?: string;
  downloadDisabledReason?: string;
}

function getActionAvailability(preview: IPreviewState): IActionAvailability {
  switch (preview.mode) {
    case "pdf-blob":
      return { openUrl: preview.openUrl, downloadUrl: preview.downloadUrl };
    case "unsupported-file":
      return {
        openDisabledReason: "Only PDF files can be opened this way - use Download instead",
        downloadUrl: preview.downloadUrl,
      };
    case "pdf-remote":
    case "webpage":
      return {
        openUrl: preview.openUrl,
        downloadDisabledReason: "Direct download is not available for this link - use Open in new tab instead",
      };
    default:
      return {};
  }
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

  const fileColumnCandidates = React.useMemo(() => parseColumnList(fileColumnName), [fileColumnName]);
  const candidatesKey = fileColumnCandidates.join(";");

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

  const [columnKinds, setColumnKinds] = React.useState<Record<string, ColumnKind>>({});
  const [columnKindsError, setColumnKindsError] = React.useState<string | undefined>(undefined);

  const [preview, setPreview] = React.useState<IPreviewState>({ mode: "loading" });
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

  // Classify each candidate in the fileColumnName fallback chain as a File column or a text/URL
  // column, once per entity+candidate-list. Not needed in test mode (TEST_MODE_DOCUMENTS carries its
  // own resolved source directly - see below).
  React.useEffect(() => {
    if (isTestMode) return;
    if (fileColumnCandidates.length === 0) return;
    let cancelled = false;
    resolveColumnKinds(entityLogicalName, fileColumnCandidates)
      .then((kinds) => {
        if (cancelled) return;
        Object.entries(kinds).forEach(([col, kind]) => {
          if (kind === "unsupported") {
            console.warn(`PDFGallery: column "${col}" in fileColumnName is neither a File column nor a text column - it will be skipped.`);
          }
        });
        setColumnKinds(kinds);
        return;
      })
      .catch((err: Error) => {
        if (!cancelled) setColumnKindsError(err.message ?? "Failed to resolve column metadata");
      });
    return () => {
      cancelled = true;
    };
  }, [entityLogicalName, candidatesKey, isTestMode]);

  // Fetch the tab label plus enough of each fallback candidate to know, per record, which one wins:
  // the <col>_name companion column for a File-kind candidate, the raw value itself for a text-kind
  // one. File columns don't expose either their bytes or their name through the dataset's own column
  // values, hence the dedicated retrieveRecord call.
  React.useEffect(() => {
    if (isTestMode) {
      const meta: Record<string, IDocMeta> = {};
      TEST_MODE_DOCUMENTS.forEach((d) => {
        meta[d.id] = d.url
          ? { status: "ready", label: d.fileName, fileName: d.fileName, source: { kind: "url", columnName: "test_url", url: d.url } }
          : { status: "ready", label: d.fileName, fileName: d.fileName, source: { kind: "file", columnName: "test_file", fileName: d.fileName } };
      });
      setDocMeta(meta);
      return;
    }

    if (fileColumnCandidates.length === 0) return;
    // Wait until every candidate's kind is known before resolving any record - otherwise a record
    // could be misclassified as "empty" purely because the metadata call has not returned yet.
    const kindsResolved = fileColumnCandidates.every((c) => columnKinds[c] !== undefined);
    if (!kindsResolved) return;

    const idsNeedingFetch = sortedRecordIds.filter((id) => !docMetaRef.current[id]);
    if (idsNeedingFetch.length === 0) return;

    const selectColsSet = new Set<string>();
    fileColumnCandidates.forEach((c) => {
      selectColsSet.add(columnKinds[c] === "file" ? `${c}_name` : c);
    });
    if (tabLabelColumnName) selectColsSet.add(tabLabelColumnName);
    const selectCols = Array.from(selectColsSet).join(",");

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

          let source: IResolvedSource | undefined;
          for (const col of fileColumnCandidates) {
            const kind = columnKinds[col];
            if (kind === "file") {
              const name = recordAny[`${col}_name`];
              if (name) {
                source = { kind: "file", columnName: col, fileName: name };
                break;
              }
            } else if (kind === "text") {
              const raw = recordAny[col];
              if (raw && raw.trim().length > 0) {
                source = { kind: "url", columnName: col, url: normalizeUrl(raw.trim()) };
                break;
              }
            }
          }

          if (!source) {
            setDocMeta((prev) => ({ ...prev, [id]: { status: "empty" } }));
            return;
          }

          const fileName = source.kind === "file" ? source.fileName ?? "Document.pdf" : deriveNameFromUrl(source.url as string);
          const label = tabLabelColumnName ? recordAny[tabLabelColumnName] || fileName : fileName;
          setDocMeta((prev) => ({ ...prev, [id]: { status: "ready", label, fileName, source } }));
          return;
        })
        .catch((err: Error) => {
          setDocMeta((prev) => ({ ...prev, [id]: { status: "error", error: err.message ?? "Failed to load document info" } }));
        });
    });
  }, [recordIdsKey, isTestMode, candidatesKey, columnKinds, tabLabelColumnName]);

  // Default/repair the selected tab whenever the set of records changes.
  React.useEffect(() => {
    if (sortedRecordIds.length === 0) {
      setSelectedId(undefined);
    } else if (!selectedId || !sortedRecordIds.includes(selectedId)) {
      setSelectedId(sortedRecordIds[0]);
    }
  }, [recordIdsKey]);

  const currentMeta = selectedId ? docMeta[selectedId] : undefined;
  const currentSource = currentMeta?.source;
  // A plain string key derived from the winning source, so the bytes/preview effect below only
  // re-runs when what needs to be fetched actually changes, not on every unrelated docMeta update.
  const sourceKey = currentSource
    ? `${currentSource.kind}:${currentSource.columnName}:${currentSource.url ?? currentSource.fileName ?? ""}`
    : undefined;

  // Resolve and fetch whichever source won the fallback chain for the selected record, on demand.
  // Only one blob is ever held at a time - the previous tab's object URL is revoked as soon as we
  // move on, to avoid memory buildup.
  React.useEffect(() => {
    if (!selectedId || !currentMeta) return;

    if (currentMeta.status === "empty") {
      setPreview({ mode: "empty" });
      return;
    }
    if (currentMeta.status !== "ready" || !currentSource) return;
    if (!isTestMode && currentSource.kind === "file" && !entitySetName) return;

    let cancelled = false;
    setPreview({ mode: "loading" });

    const load = async (): Promise<IPreviewState> => {
      if (isTestMode) {
        if (currentSource.kind === "url") {
          const testUrl = currentSource.url as string;
          // Reuses the real detection helper against a fake URL, purely so the test harness
          // exercises both the "PDF via web location" and "webpage" branches without ever making a
          // real network call - a synthetic PDF stands in for the former, and a real, always-
          // embeddable public page (example.com sends no framing-blocking headers) for the latter.
          if (looksLikePdfUrl(testUrl)) {
            const blob = base64ToBlob(TEST_MODE_PDF_BASE64, "application/pdf");
            const url = URL.createObjectURL(blob);
            blobUrlRef.current = url;
            return { mode: "pdf-blob", displaySrc: url, openUrl: url, downloadUrl: url };
          }
          return { mode: "webpage", displaySrc: testUrl, openUrl: testUrl };
        }
        const blob = base64ToBlob(TEST_MODE_PDF_BASE64, "application/pdf");
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        return { mode: "pdf-blob", displaySrc: url, openUrl: url, downloadUrl: url };
      }

      if (currentSource.kind === "file") {
        const { blob, isPdf } = await fetchPdfBytes(entitySetName as string, selectedId, currentSource.columnName);
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        return isPdf ? { mode: "pdf-blob", displaySrc: url, openUrl: url, downloadUrl: url } : { mode: "unsupported-file", downloadUrl: url };
      }

      const targetUrl = currentSource.url as string;
      const resolved = await resolveUrlSource(targetUrl);
      if (resolved.mode === "pdf-blob" && resolved.blob) {
        const url = URL.createObjectURL(resolved.blob);
        blobUrlRef.current = url;
        return { mode: "pdf-blob", displaySrc: url, openUrl: url, downloadUrl: url };
      }
      if (resolved.mode === "pdf-remote") {
        // Could not fetch the bytes ourselves (almost always CORS) - point the iframe straight at
        // the remote URL instead and let the browser's own PDF viewer request it directly. There is
        // no blob URL to offer a same-origin Open/Download from here, so Open just reopens the
        // remote URL and Download is disabled (see getActionAvailability).
        return { mode: "pdf-remote", displaySrc: targetUrl, openUrl: targetUrl };
      }
      return { mode: "webpage", displaySrc: targetUrl, openUrl: targetUrl };
    };

    load()
      .then((result) => {
        if (!cancelled) setPreview(result);
        return;
      })
      .catch((err: Error) => {
        if (!cancelled) setPreview({ mode: "error", error: err.message ?? "Failed to load document" });
      });

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = undefined;
      }
    };
  }, [selectedId, sourceKey, currentMeta?.status, entitySetName, isTestMode]);

  // Best-effort fallback for the "webpage" preview mode: browsers do not reliably fire an error
  // event when a site refuses to be framed (X-Frame-Options/CSP frame-ancestors just render blank or
  // a browser-native "refused to connect" page, and the iframe still fires `load` regardless) - so
  // this timeout only reliably catches the "never loaded at all" case (DNS failure, a dead link, a
  // stalled connection). A page that loads but silently declines to render inside the frame still
  // shows as an (empty-looking) iframe rather than falling back to the link card - that is the most
  // a client-only control can do without cooperation from the target site.
  const [webpageBlocked, setWebpageBlocked] = React.useState(false);
  const webpageTimeoutRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    setWebpageBlocked(false);
    if (webpageTimeoutRef.current !== undefined) {
      window.clearTimeout(webpageTimeoutRef.current);
      webpageTimeoutRef.current = undefined;
    }
    if (preview.mode !== "webpage") return undefined;
    webpageTimeoutRef.current = window.setTimeout(() => setWebpageBlocked(true), 6000);
    return () => {
      if (webpageTimeoutRef.current !== undefined) {
        window.clearTimeout(webpageTimeoutRef.current);
        webpageTimeoutRef.current = undefined;
      }
    };
  }, [preview.mode, preview.displaySrc]);

  const handleWebpageLoad = (): void => {
    if (webpageTimeoutRef.current !== undefined) {
      window.clearTimeout(webpageTimeoutRef.current);
      webpageTimeoutRef.current = undefined;
    }
  };

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

  const currentLabel = currentMeta?.status === "ready" ? currentMeta.label : "Document";
  const currentFileName = currentMeta?.status === "ready" ? currentMeta.fileName ?? "document.pdf" : "document.pdf";

  const handleOpenRecord = (): void => {
    if (!selectedId) return;
    navigation.openForm({ entityName: entityLogicalName, entityId: selectedId }).catch((err: Error) => {
      console.error("Failed to open record", err);
    });
  };

  const isVertical = layoutStyle === "Vertical";

  const availability = getActionAvailability(preview);
  const showOpenButton = !!availability.openUrl || !!availability.openDisabledReason;
  const showDownloadButton = allowDownload && (!!availability.downloadUrl || !!availability.downloadDisabledReason);

  const actionButtons = selectedId && (
    <div className="pdfgallery-toolbar-actions">
      {allowOpenRecord && <ActionButton iconName="Forward" label="Open Record" showLabel={showButtonLabels} onClick={handleOpenRecord} />}
      {showOpenButton && (
        <ActionButton
          iconName="OpenInNewWindow"
          label="Open in new tab"
          showLabel={showButtonLabels}
          disabled={!availability.openUrl}
          disabledReason={availability.openDisabledReason}
          onClick={() => availability.openUrl && window.open(availability.openUrl, "_blank", "noopener,noreferrer")}
        />
      )}
      {showDownloadButton && (
        <ActionButton
          iconName="Download"
          label="Download"
          showLabel={showButtonLabels}
          disabled={!availability.downloadUrl}
          disabledReason={availability.downloadDisabledReason}
          onClick={() => availability.downloadUrl && triggerDownload(availability.downloadUrl, currentFileName as string)}
        />
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
              const fullLabel =
                meta?.status === "ready"
                  ? meta.label ?? id
                  : meta?.status === "empty"
                    ? "No file"
                    : meta?.status === "error"
                      ? "⚠ Error"
                      : "Loading…";
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
            {columnKindsError && <MessageBar messageBarType={MessageBarType.error}>{columnKindsError}</MessageBar>}
            {preview.mode === "loading" && (
              <div className="pdfgallery-centered">
                <Spinner label="Loading document…" size={SpinnerSize.large} />
              </div>
            )}
            {preview.mode === "error" && (
              <div className="pdfgallery-centered">
                <MessageBar messageBarType={MessageBarType.error}>{preview.error}</MessageBar>
              </div>
            )}
            {preview.mode === "empty" && (
              <div className="pdfgallery-centered pdfgallery-unsupported">
                <Icon iconName="Info" className="pdfgallery-unsupported-icon" />
                <span>No file or link is set for this document.</span>
              </div>
            )}
            {preview.mode === "unsupported-file" && (
              <div className="pdfgallery-centered pdfgallery-unsupported">
                <Icon iconName="Info" className="pdfgallery-unsupported-icon" />
                <span>This file can&apos;t be previewed here - only PDF files are supported. Use Download to save it.</span>
              </div>
            )}
            {(preview.mode === "pdf-blob" || preview.mode === "pdf-remote") && preview.displaySrc && (
              // The #view=FitH PDF Open Parameter forces the browser's built-in viewer to fit the
              // page to the frame's width - only meaningful for our own blob: URL, since we cannot
              // control how a remote server's PDF is served. Without it, "Automatic" zoom does not
              // reliably fit-to-width when the PDF's actual page size (e.g. US Letter) does not match
              // our fixed A4-shaped frame, leaving the page looking zoomed in and cropped.
              <iframe
                key={preview.displaySrc}
                title={currentLabel}
                src={preview.mode === "pdf-blob" ? `${preview.displaySrc}#view=FitH` : preview.displaySrc}
                className="pdfgallery-iframe"
              />
            )}
            {preview.mode === "webpage" && preview.displaySrc && !webpageBlocked && (
              <iframe key={preview.displaySrc} title={currentLabel} src={preview.displaySrc} className="pdfgallery-iframe" onLoad={handleWebpageLoad} />
            )}
            {preview.mode === "webpage" && webpageBlocked && preview.openUrl && (
              <div className="pdfgallery-centered pdfgallery-linkcard">
                <Icon iconName="OpenInNewWindow" className="pdfgallery-linkcard-icon" />
                <div className="pdfgallery-linkcard-host">{urlHostname(preview.openUrl)}</div>
                <span>This page did not load in the preview - it may not allow being embedded.</span>
                <DefaultButton
                  text="Open Page"
                  iconProps={{ iconName: "OpenInNewWindow" }}
                  onClick={() => window.open(preview.openUrl, "_blank", "noopener,noreferrer")}
                />
              </div>
            )}
          </div>
        </div>

        {isVertical && (
          <div className="pdfgallery-sidebar" role="tablist" aria-orientation="vertical">
            {sortedRecordIds.map((id) => {
              const meta = docMeta[id];
              const fullLabel =
                meta?.status === "ready"
                  ? meta.label ?? id
                  : meta?.status === "empty"
                    ? "No file"
                    : meta?.status === "error"
                      ? "⚠ Error"
                      : "Loading…";
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
