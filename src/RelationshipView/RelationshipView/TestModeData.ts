export interface ITestModeRecord {
  id: string;
  name: string;
  parentId?: string;
  statecode: number;
  customAttribute1?: string;
  customAttribute2?: string;
  customAttribute3?: string;
}

// The record the test harness pretends the control is placed on.
export const TEST_MODE_CURRENT_RECORD_ID = "test-current";
export const TEST_MODE_ENTITY_LOGICAL_NAME = "lops_contract";

// A small canned hierarchy: root -> parent -> CURRENT -> two children, one of which has its own
// child. Names/attributes are deliberately oversized (some with no natural break point) to stress
// the row/quick-view truncation and wrapping rules.
export const TEST_MODE_RECORDS: ITestModeRecord[] = [
  {
    id: "test-root",
    name: "Azure Cloud Infrastructure Statement of Work for Global Multi-Region Enterprise Data Center Migration and Managed Network Operations",
    statecode: 0,
    customAttribute1: "Statement of Work / Master Service Agreement Umbrella Category for Infrastructure Engagements",
    customAttribute2: "Mar 1, 2021 - Mar 31, 2024 (renews automatically unless terminated with 180 days written notice)",
    customAttribute3:
      "Defines scope and deliverables for Azure cloud migration and infrastructure buildout, including network segmentation, identity federation, disaster recovery failover testing, and a multi-phase decommissioning plan for the legacy on-premises data centers across four regions.",
  },
  {
    id: "test-parent",
    name: "Microsoft365EnterpriseLicensingAndManagedSupportServicesStatementOfWorkForFiscalYearsTwentyTwentyTwoThroughTwentyTwentyFive",
    parentId: "test-root",
    statecode: 0,
    customAttribute1: "Statement of Work",
    customAttribute2: "Jun 2022 - Jun 2025",
    customAttribute3:
      "Covers M365 E5 licensing, deployment, and ongoing support services for approximately 12,000 seats across all regional subsidiaries, including Copilot pilot rollout and quarterly business reviews.",
  },
  {
    id: TEST_MODE_CURRENT_RECORD_ID,
    name: "SupercalifragilisticexpialidociousMultiYearGlobalEnterpriseFrameworkAgreementRenewalAmendmentNumberFortyTwoWithExtraLongIdentifierStringForStressTestingPurposesOnly",
    parentId: "test-parent",
    statecode: 0,
    customAttribute1: "Amendment",
    customAttribute2: "Apr 2022 - Apr 2026",
    customAttribute3:
      "Orphan: amendment may belong to 2 parents. Amends 240 seats on SOW with Microsoft, extends the disaster-recovery SLA from 99.9% to 99.95%, and adds a right-to-audit clause covering all four regional data processing addenda executed since 2019.",
  },
  {
    id: "test-child-1",
    name: "Azure SOW - Amendment #1: Expansion of Premium Support Tier, Additional Storage Capacity, and Extended Business-Hours Coverage",
    parentId: TEST_MODE_CURRENT_RECORD_ID,
    statecode: 0,
    customAttribute1: "Amendment",
    customAttribute2: "Sep 2021 - Mar 2024",
    customAttribute3: "Expands cloud storage capacity and adds premium support tier to Azure SOW",
  },
  {
    id: "test-child-2",
    name: "M365SOW-Amendment#2-CopilotAddOnLicensesAndExtendedTermForAllRegionalSubsidiariesIncludingAPACAndEMEA",
    parentId: TEST_MODE_CURRENT_RECORD_ID,
    statecode: 1,
    customAttribute1: "Amendment",
    customAttribute2: "Apr 2024 - Jun 2025",
    customAttribute3: "Extends term and adds Copilot for Microsoft 365 add-on licenses",
  },
  {
    id: "test-grandchild-1",
    name: "Azure SOW - Amendment #2",
    parentId: "test-child-1",
    statecode: 0,
    customAttribute1: "Amendment",
    customAttribute2: "Jan 2023 - Mar 2024",
    customAttribute3:
      "Adds Azure AI services and machine learning workloads to scope, including a dedicated GPU capacity reservation, a new data residency addendum for EU customers, and revised pricing tiers effective the first day of the following fiscal quarter.",
  },
  // Sister of the CURRENT record - shares the same parentId ("test-parent") - used to exercise
  // the siblingDisplay property. Has its own child so "Sister Plus Children" has something to show
  // beyond "Direct Only".
  {
    id: "test-sister-1",
    name: "M365 SOW - Amendment #1: Pilot Expansion To EMEA Region Prior To Global Rollout",
    parentId: "test-parent",
    statecode: 0,
    customAttribute1: "Amendment",
    customAttribute2: "Jan 2022 - Jun 2022",
    customAttribute3: "Pilot amendment predating the current amendment - superseded by it.",
  },
  {
    id: "test-sister-1-child",
    name: "M365 SOW - Amendment #1a: Pilot Extension",
    parentId: "test-sister-1",
    statecode: 1,
    customAttribute1: "Amendment",
    customAttribute2: "Jun 2022 - Sep 2022",
    customAttribute3: "Short extension of the EMEA pilot amendment.",
  },
  // Sister of test-parent (the CURRENT record's immediate parent, one level further up the
  // ancestor chain) - not a sister of the current record itself. Exercises the ancestor-level
  // sibling rendering path (buildVirtualRoots' ancestorSiblings), not just current's own level.
  {
    id: "test-parent-sister",
    name: "Global Enterprise Master Agreement - Amendment For Data Residency Terms",
    parentId: "test-root",
    statecode: 0,
    customAttribute1: "Amendment",
    customAttribute2: "Jan 2020 - Dec 2020",
    customAttribute3: "Sister of the current record's immediate parent, not of the current record itself.",
  },
];

// A simple avatar placeholder used as the thumbnail image in test mode (no live Dataverse to fetch
// bytes from). Plain SVG markup, percent-encoded rather than base64 so it stays readable here.
const TEST_MODE_THUMBNAIL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">' +
  '<rect width="64" height="64" fill="#c8c6c4"/>' +
  '<circle cx="32" cy="25" r="12" fill="#ffffff"/>' +
  '<path d="M10 58c0-15 10-24 22-24s22 9 22 24" fill="#ffffff"/>' +
  "</svg>";
export const TEST_MODE_THUMBNAIL_DATA_URI = `data:image/svg+xml,${encodeURIComponent(TEST_MODE_THUMBNAIL_SVG)}`;

// MDL2 icon names standing in for a text-column thumbnail source, keyed by record id - used when
// the harness's Thumbnail Column value contains "icon" (test mode has no live EntityDefinitions
// call to distinguish an Image column from a text column, so the harness signals icon mode this
// way instead). Any valid Fluent UI icon name works since initializeIcons() already registers the
// full MDL2 set.
export const TEST_MODE_ICON_NAMES: Record<string, string> = {
  "test-root": "Handshake",
  "test-parent": "ContactCard",
  [TEST_MODE_CURRENT_RECORD_ID]: "Mail",
  "test-child-1": "Ringer",
  "test-child-2": "Trophy2",
  "test-grandchild-1": "Cloud",
  "test-sister-1": "Certificate",
  "test-sister-1-child": "Flag",
};

// Column/section layout emulating a two-column form's contents, used when quickViewFormName is
// set in test mode - mirrors the shape parseFormLayout() produces from a real form's FormXML (a
// flat, document-ordered list of section groups; consecutive groups with the same tabIndex render
// side-by-side, and sectionLabel demonstrates a visible section header). One label is
// deliberately oversized to stress the fixed-width label column. The second column's section has
// no sectionLabel, standing in for a section with showlabel="false" or a hidden section - to
// confirm the header only renders when one is actually present.
export const TEST_MODE_QUICK_VIEW_COLUMNS: {
  tabIndex: number;
  columnIndex: number;
  widthPercent?: number;
  sectionLabel?: string;
  fields: { logicalName: keyof ITestModeRecord; label: string }[];
}[] = [
  {
    tabIndex: 0,
    columnIndex: 0,
    widthPercent: 50,
    sectionLabel: "Overview",
    fields: [
      { logicalName: "customAttribute1", label: "Record Type / Category" },
      { logicalName: "customAttribute2", label: "Term" },
    ],
  },
  {
    tabIndex: 0,
    columnIndex: 1,
    widthPercent: 50,
    fields: [
      {
        logicalName: "customAttribute3",
        label: "Extremely Long Field Label Used To Stress Test The Fixed-Width Label Column In The Expandable Quick View Panel",
      },
    ],
  },
];

// Demonstrates the Choice Color Display option in test mode: customAttribute1's values are
// standing in for a Choice/optionset field, each mapped to a color as if it were configured on
// the real optionset's options (mirrors what resolveChoiceColors fetches from Dataverse).
export const TEST_MODE_CHOICE_COLORS: Record<string, string> = {
  "Statement of Work": "#0078D4",
  Amendment: "#107C10",
};
