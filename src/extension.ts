// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { isFhirBundle } from './is-fhir-bundle';
import { minifyBundle } from './minify-bundle';
import { BundleResourcesTreeProvider } from './create-bundle-tree';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "fhir-tools" is now active!');

  // Register commands
  let isBundleCommand = vscode.commands.registerCommand('fhir-extension.isBundle', isFhirBundle);
  context.subscriptions.push(isBundleCommand);

  let minifyCommand = vscode.commands.registerCommand('fhir-extension.minifyBundle', minifyBundle);
  context.subscriptions.push(minifyCommand);

  vscode.window.registerTreeDataProvider(
    'fhirResources',
    new BundleResourcesTreeProvider()
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
