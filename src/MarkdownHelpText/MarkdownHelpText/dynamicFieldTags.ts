// "Dynamic Field Tags" - {!fieldLogicalName} / {!lookupFieldLogicalName:targetFieldLogicalName}
// interpolation, resolved against the record the control is bound to and spliced into the
// rendered Markdown by remarkFieldTags.ts. Mirrors RelationshipViewControl.tsx's
// resolveAttributeMetadata/formatAttributeValue/toWebApiSelectFields pattern (trimmed - no
// Image/File/choice-color handling, since those don't make sense as inline text), duplicated
// rather than imported since this repo has no shared code between controls.

export const FIELD_TAG_PATTERN = /\{!([A-Za-z_]\w*)(?::([A-Za-z_]\w*))?\}/g;

export interface IParsedFieldTag {
  raw: string;
  field: string;
  targetField?: string;
}

export interface IFieldTagResolution {
  status: "value" | "empty" | "unknown";
  text: string;
}

interface IFieldMeta {
  logicalName: string;
  attributeType: string;
  dateFormat?: string;
}

// Finds every distinct {!...} tag in the source text. Runs on the raw Markdown string rather
// than a parsed AST, so it may pick up a tag that's actually sitting inside a fenced code block
// or inline code span (e.g. documentation *about* this feature, written using it as an example) -
// harmless, since remarkFieldTags only ever substitutes inside plain "text" mdast nodes, which
// code spans/blocks are not. Worst case is one wasted metadata/record fetch for a tag that was
// never going to be substituted anyway.
export function parseFieldTags(markdown: string): IParsedFieldTag[] {
  const seen = new Map<string, IParsedFieldTag>();
  const re = new RegExp(FIELD_TAG_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown))) {
    if (!seen.has(match[0])) {
      seen.set(match[0], { raw: match[0], field: match[1], targetField: match[2] || undefined });
    }
  }
  return Array.from(seen.values());
}

function unknownResolution(tag: IParsedFieldTag): IFieldTagResolution {
  const label = tag.targetField ? `${tag.field}:${tag.targetField}` : tag.field;
  return { status: "unknown", text: `[Unknown field: ${label}]` };
}

const EMPTY_RESOLUTION: IFieldTagResolution = { status: "empty", text: "empty" };

async function resolveAttributeMetadata(entityLogicalName: string, logicalNames: string[]): Promise<Record<string, IFieldMeta>> {
  const uniqueNames = Array.from(new Set(logicalNames));
  if (uniqueNames.length === 0) return {};

  const filter = uniqueNames.map((name) => `LogicalName eq '${name.replace(/'/g, "''")}'`).join(" or ");
  const url = `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes?$select=LogicalName,AttributeType&$filter=${filter}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Failed to resolve attribute metadata (${response.status} ${response.statusText})`);
  }
  const data = (await response.json()) as { value: { LogicalName: string; AttributeType: string }[] };

  const result: Record<string, IFieldMeta> = {};
  data.value.forEach((a) => {
    result[a.LogicalName] = { logicalName: a.LogicalName, attributeType: a.AttributeType };
  });

  const dateTimeNames = Object.values(result)
    .filter((a) => a.attributeType === "DateTime")
    .map((a) => a.logicalName);

  await Promise.all(
    dateTimeNames.map(async (name) => {
      const formatUrl = `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${name}')/Microsoft.Dynamics.CRM.DateTimeAttributeMetadata?$select=Format`;
      const formatResponse = await fetch(formatUrl, { headers: { Accept: "application/json" } });
      if (formatResponse.ok) {
        const formatData = (await formatResponse.json()) as { Format: string };
        result[name].dateFormat = formatData.Format;
      }
    })
  );

  return result;
}

// Dataverse's Web API only allows $select-ing a Lookup/Customer/Owner attribute via its
// "_<logicalname>_value" bound-value form - same reasoning as RelationshipView's
// toWebApiSelectFields.
function toSelectFields(logicalName: string, attributeMeta: Record<string, IFieldMeta>): string[] {
  const meta = attributeMeta[logicalName];
  if (meta?.attributeType === "Lookup" || meta?.attributeType === "Customer" || meta?.attributeType === "Owner") {
    return [`_${logicalName}_value`];
  }
  return [logicalName];
}

// Formats one field's value per its Dataverse type, same rules as RelationshipView's
// formatAttributeValue: Lookup/Customer/Owner show the target record's own name; Money is
// rebuilt as "<symbol> <value>"; DateTime is reformatted client-side via the browser's own
// locale (FormattedValue reflects the server/org's date settings, not the viewer's); every
// other type (choice/status/text/number) already gets a correct label from FormattedValue.
// Returns undefined for a null/missing value, distinct from "" for a present-but-blank string.
function formatFieldValue(record: ComponentFramework.WebApi.Entity, logicalName: string, meta: IFieldMeta): string | undefined {
  if (meta.attributeType === "Lookup" || meta.attributeType === "Customer" || meta.attributeType === "Owner") {
    const valueKey = `_${logicalName}_value`;
    const id = record[valueKey] as string | undefined;
    if (!id) return undefined;
    const name = record[`${valueKey}@OData.Community.Display.V1.FormattedValue`] as string | undefined;
    return name ?? id;
  }

  const rawValue = record[logicalName];
  if (rawValue === undefined || rawValue === null) return undefined;
  const formatted = record[`${logicalName}@OData.Community.Display.V1.FormattedValue`] as string | undefined;

  if (meta.attributeType === "Money") {
    const numeric = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (!isNaN(numeric)) {
      const numberText = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric);
      const symbolMatch = formatted?.match(/^-?\s*([^\d\s.,+-]+)/);
      const symbol = symbolMatch?.[1];
      return symbol ? `${symbol} ${numberText}` : numberText;
    }
  }

  if (meta.attributeType === "DateTime") {
    const date = new Date(rawValue as string);
    if (!isNaN(date.getTime())) {
      const options: Intl.DateTimeFormatOptions = meta.dateFormat === "DateOnly" ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" };
      return new Intl.DateTimeFormat(undefined, options).format(date);
    }
  }

  return formatted ?? String(rawValue);
}

// Resolves every {!...}/{!...:...} tag found in `markdown` against the live record identified by
// entityLogicalName/entityId. Two round trips at most: one for the current record's own fields
// (plus the bound-value + lookuplogicalname of every lookup field used for traversal), and one
// per distinct (target entity, target record id) pair referenced by a lookup-traversal tag - not
// one per tag, so five tags all reading different fields off the same related record only cost a
// single extra fetch.
export async function resolveFieldTags(
  webAPI: ComponentFramework.WebApi,
  entityLogicalName: string,
  entityId: string,
  markdown: string
): Promise<Map<string, IFieldTagResolution>> {
  const resolutions = new Map<string, IFieldTagResolution>();
  const tags = parseFieldTags(markdown);
  if (tags.length === 0) return resolutions;

  const primaryFieldNames = Array.from(new Set(tags.map((t) => t.field)));

  let primaryMeta: Record<string, IFieldMeta>;
  let primaryRecord: ComponentFramework.WebApi.Entity;
  try {
    primaryMeta = await resolveAttributeMetadata(entityLogicalName, primaryFieldNames);
    const select = primaryFieldNames.flatMap((name) => toSelectFields(name, primaryMeta)).join(",");
    primaryRecord = await webAPI.retrieveRecord(entityLogicalName, entityId, `?$select=${select}`);
  } catch (err) {
    console.warn("MarkdownHelpText: failed to resolve dynamic field tags", err);
    tags.forEach((t) => resolutions.set(t.raw, unknownResolution(t)));
    return resolutions;
  }

  const lookupBuckets = new Map<string, { entity: string; id: string; fields: Set<string>; tags: IParsedFieldTag[] }>();

  tags.forEach((tag) => {
    const meta = primaryMeta[tag.field];
    if (!meta) {
      resolutions.set(tag.raw, unknownResolution(tag));
      return;
    }

    if (!tag.targetField) {
      const value = formatFieldValue(primaryRecord, tag.field, meta);
      resolutions.set(tag.raw, value !== undefined ? { status: "value", text: value } : EMPTY_RESOLUTION);
      return;
    }

    if (meta.attributeType !== "Lookup" && meta.attributeType !== "Customer" && meta.attributeType !== "Owner") {
      resolutions.set(tag.raw, unknownResolution(tag));
      return;
    }

    const valueKey = `_${tag.field}_value`;
    const targetId = primaryRecord[valueKey] as string | undefined;
    const targetEntity = primaryRecord[`${valueKey}@Microsoft.Dynamics.CRM.lookuplogicalname`] as string | undefined;
    if (!targetId || !targetEntity) {
      resolutions.set(tag.raw, EMPTY_RESOLUTION);
      return;
    }

    const key = `${targetEntity}|${targetId}`;
    if (!lookupBuckets.has(key)) {
      lookupBuckets.set(key, { entity: targetEntity, id: targetId, fields: new Set(), tags: [] });
    }
    const bucket = lookupBuckets.get(key) as { entity: string; id: string; fields: Set<string>; tags: IParsedFieldTag[] };
    bucket.fields.add(tag.targetField);
    bucket.tags.push(tag);
  });

  await Promise.all(
    Array.from(lookupBuckets.values()).map(async (bucket) => {
      try {
        const targetMeta = await resolveAttributeMetadata(bucket.entity, Array.from(bucket.fields));
        const select = Array.from(bucket.fields)
          .flatMap((name) => toSelectFields(name, targetMeta))
          .join(",");
        const targetRecord = await webAPI.retrieveRecord(bucket.entity, bucket.id, `?$select=${select}`);
        bucket.tags.forEach((tag) => {
          const fieldMeta = targetMeta[tag.targetField as string];
          if (!fieldMeta) {
            resolutions.set(tag.raw, unknownResolution(tag));
            return;
          }
          const value = formatFieldValue(targetRecord, tag.targetField as string, fieldMeta);
          resolutions.set(tag.raw, value !== undefined ? { status: "value", text: value } : EMPTY_RESOLUTION);
        });
      } catch (err) {
        console.warn("MarkdownHelpText: failed to resolve lookup-traversal field tag", err);
        bucket.tags.forEach((tag) => resolutions.set(tag.raw, unknownResolution(tag)));
      }
    })
  );

  return resolutions;
}

// Test-mode resolution: no live Web API/metadata to call, so tags are resolved synchronously
// against a small fixed dictionary (see TestModeData.ts) purely by field name. Distinct from the
// live path only in how a value is looked up - the same status rules (value/empty/unknown) apply.
export function resolveFieldTagsTestMode(
  markdown: string,
  fieldValues: Record<string, string | undefined>,
  lookupTargets: Record<string, Record<string, string | undefined>>
): Map<string, IFieldTagResolution> {
  const resolutions = new Map<string, IFieldTagResolution>();
  const tags = parseFieldTags(markdown);

  tags.forEach((tag) => {
    if (!tag.targetField) {
      if (!(tag.field in fieldValues)) {
        resolutions.set(tag.raw, unknownResolution(tag));
        return;
      }
      const value = fieldValues[tag.field];
      resolutions.set(tag.raw, value ? { status: "value", text: value } : EMPTY_RESOLUTION);
      return;
    }

    const target = lookupTargets[tag.field];
    if (!target) {
      resolutions.set(tag.raw, unknownResolution(tag));
      return;
    }
    if (!(tag.targetField in target)) {
      resolutions.set(tag.raw, unknownResolution(tag));
      return;
    }
    const value = target[tag.targetField];
    resolutions.set(tag.raw, value ? { status: "value", text: value } : EMPTY_RESOLUTION);
  });

  return resolutions;
}
