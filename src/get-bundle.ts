import { Bundle } from 'fhir/r4';
import * as vscode from 'vscode';

export function getAllVisibleBundles(): { json: Bundle; fileName: string;}[] {
  const bundles: { json: Bundle; fileName: string;}[] = [];
  vscode.window.visibleTextEditors.forEach( editor => {
    const document = editor.document;
    const bundle = getBundleFromDocument(document);
    if (bundle) {
      bundles.push(bundle);
    }
  });
  return bundles;
}

export function getActiveBundle(): { json: Bundle; fileName: string;} | undefined {
  const document = getActiveDocument();
  if (!document) { return; }
  return getBundleFromDocument(document);
}

export function getActiveDocument(): vscode.TextDocument | undefined {
  return vscode.window.activeTextEditor?.document;
}

export function getBundleFromDocument(document: vscode.TextDocument): { json: Bundle; fileName: string;} | undefined {
  const documentText = document.getText();
  const documentFileName = document.fileName;

  // First, is the text json?
  let parsedContents;
  try {
    parsedContents = JSON.parse(documentText);
  } catch (jsonError) {
    return;
  }

  // Parsed object is a FHIR resource bundle
  if (parsedContents.hasOwnProperty('resourceType') && parsedContents.resourceType === 'Bundle') {
    return { json: parsedContents as Bundle, fileName: documentFileName };
  }

  return;
}