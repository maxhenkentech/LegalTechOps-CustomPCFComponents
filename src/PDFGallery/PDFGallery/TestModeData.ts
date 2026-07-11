export interface ITestModeDocument {
  id: string;
  fileName: string;
}

export const TEST_MODE_DOCUMENTS: ITestModeDocument[] = [
  { id: "test-doc-1", fileName: "Master Services Agreement.pdf" },
  { id: "test-doc-2", fileName: "Statement of Work - Q3.pdf" },
  { id: "test-doc-3", fileName: "NDA - Acme Corp.pdf" },
  { id: "test-doc-4", fileName: "Data Processing Addendum.pdf" },
  { id: "test-doc-5", fileName: "Vendor Onboarding Packet.pdf" },
  { id: "test-doc-6", fileName: "Amendment No. 1.pdf" },
  { id: "test-doc-7", fileName: "Certificate of Insurance.pdf" },
  { id: "test-doc-8", fileName: "Renewal Notice - 2027.pdf" },
  { id: "test-doc-9", fileName: "Termination Letter.pdf" },
  { id: "test-doc-10", fileName: "Signed Cover Sheet.pdf" },
];

// A minimal one-page valid PDF ("PDFGallery Test Document"), used only in the PCF test harness
// where there is no live Dataverse backend to fetch real file bytes from.
export const TEST_MODE_PDF_BASE64 =
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA0IDAgUiA+PiA+PiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNSAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iago1IDAgb2JqCjw8IC9MZW5ndGggNTUgPj4Kc3RyZWFtCkJUIC9GMSAyNCBUZiA3MiA3MDAgVGQgKFBERkdhbGxlcnkgVGVzdCBEb2N1bWVudCkgVGogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDEgMDAwMDAgbiAKMDAwMDAwMDMxMSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQxNgolJUVPRg==";
