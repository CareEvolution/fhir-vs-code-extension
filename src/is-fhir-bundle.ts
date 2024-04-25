import * as vscode from 'vscode';
import { getBundle } from './get-bundle';

export function isFhirBundle() {
  const bundle = getBundle();
  if (bundle) {
      vscode.window.showInformationMessage('File is a FHIR bundle');
  }
}