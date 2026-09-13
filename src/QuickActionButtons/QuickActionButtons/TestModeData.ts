// Fake "current record" used only in the PCF test harness (localhost:8181), so a button's
// Actions JSON and expressions can be exercised end-to-end without a live Dataverse form --
// there is no real Xrm.Page there. Same role as PDFGallery/RelationshipView/MarkdownHelpText's
// TestModeData.ts fixtures.

import { ExprValue, FieldReader, LookupRef } from "./ExpressionEngine";
import { FieldAccessor, WriteResult } from "./XrmFieldAccess";

const TEST_USER: LookupRef = { id: "33333333-3333-3333-3333-333333333333", entityType: "systemuser", name: "Test User (you)" };

const TEST_RECORD: Record<string, ExprValue> = {
  hek_firstname: "Jane",
  hek_lastname: "Doe",
  hek_status: "Draft",
  hek_dueamount: 1500,
  hek_duedays: 30,
  hek_approvedon: null,
  // Lookup, exercised the same way a real "ownerid"/"hek_primarycontact" field would be.
  ownerid: { id: "22222222-2222-2222-2222-222222222222", entityType: "systemuser", name: "Original Owner" } as LookupRef,
  hek_primarycontact: null,
  // Multi-select choice, stored the same comma-separated-string shape the Dataverse Web API
  // uses -- see coerceForAttribute's multiselectoptionset case in XrmFieldAccess.ts.
  hek_multichoice: "100000001,100000002",
};

export function createTestFieldAccessor(): FieldAccessor {
  const readField: FieldReader = (fieldName) => {
    if (!(fieldName in TEST_RECORD)) {
      console.warn(`[lops.QuickActionButtons] (test mode) Field "${fieldName}" is not in the test fixture record; evaluated to null. Known fields: ${Object.keys(TEST_RECORD).join(', ')}`);
      return null;
    }
    return TEST_RECORD[fieldName];
  };

  const writeField = (fieldName: string, value: ExprValue): WriteResult => {
    if (!(fieldName in TEST_RECORD)) {
      return {
        ok: false,
        error: `(test mode) Field "${fieldName}" is not in the test fixture record. Known fields: ${Object.keys(TEST_RECORD).join(', ')}`,
      };
    }
    TEST_RECORD[fieldName] = value;
    return { ok: true };
  };

  const fieldExists = (fieldName: string): boolean => fieldName in TEST_RECORD;

  const getCurrentUser = (): LookupRef => TEST_USER;

  const saveRecord = (): Promise<WriteResult> => {
    console.log("[lops.QuickActionButtons] (test mode) save simulated -- no live Xrm.Page to save.");
    return Promise.resolve({ ok: true });
  };

  return { formAvailable: true, readField, writeField, fieldExists, getCurrentUser, saveRecord };
}
