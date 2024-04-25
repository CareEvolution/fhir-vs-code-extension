import { Bundle } from 'fhir/r4';
import * as vscode from 'vscode';

export function getBundle() {
  const activeTextEditor = vscode.window.activeTextEditor;
  if (!activeTextEditor) {
    vscode.window.showInformationMessage('There is no open file');
    return null;
  }

  const document = activeTextEditor.document;
  const documentText = document.getText();
  const documentFileName = document.fileName;

  // First, is the text json?
  // Parse the thing into objects
  let parsedContents;
  try {
    parsedContents = JSON.parse(documentText);
  } catch (jsonError) {
    vscode.window.showInformationMessage('File is NOT a FHIR bundle');
    return null;
  }

  // Parsed object is a FHIR resource bundle
  if (parsedContents.hasOwnProperty('resourceType') && parsedContents.resourceType === 'Bundle') {
    return { json: parsedContents as Bundle, fileName: documentFileName };
  }

  vscode.window.showInformationMessage('File is NOT a FHIR bundle');
  return null;
}