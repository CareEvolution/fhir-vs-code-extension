import * as vscode from 'vscode';
import { getActiveBundle } from './get-bundle';

export function isFhirBundle() {
  const bundle = getActiveBundle();
  if (bundle) {
      vscode.window.showInformationMessage('File is a FHIR bundle');
  }
}