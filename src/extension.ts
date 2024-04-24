// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "fhir-tools" is now active!');

  let isBundleCommand = vscode.commands.registerCommand('fhir-tools.isBundle', () => {
    const activeTextEditor = vscode.window.activeTextEditor;
    if (!activeTextEditor) {
      vscode.window.showInformationMessage('There is no open file');
      return;
    }
    const document = activeTextEditor.document;
    const documentText = document.getText();

    // First, is the text json?
    // Parse the thing into objects
    let parsedContents;
    try {
      parsedContents = JSON.parse(documentText);
    } catch (jsonError) {
      vscode.window.showInformationMessage('File is NOT a FHIR bundle');
      return;
    }

    // Parsed object is a FHIR resource bundle
    if (parsedContents.hasOwnProperty('resourceType') && parsedContents.resourceType === 'Bundle') {
      vscode.window.showInformationMessage('File is a FHIR bundle');
      return;
    }

    vscode.window.showInformationMessage('File is NOT a FHIR bundle');

  });
  context.subscriptions.push(isBundleCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
