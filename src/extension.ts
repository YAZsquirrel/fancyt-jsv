'use strict';

import * as vscode from 'vscode';
import { SchemaTreeProvider } from './SchemaTreeProvider';
import { INode } from './INode';
import { JSONNode } from './JSONNode';
import { SchemaNode } from './SchemaNode';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "FancyT JSV" is now active!');
	let provider = new SchemaTreeProvider(); 
	let treeView = vscode.window.createTreeView('schemaProvider', {
		'treeDataProvider' : provider,
		'canSelectMany' : true,
		'dragAndDropController' : provider,
		'showCollapseAll' : true,
		'manageCheckboxStateManually': false,
	});
	

	let disposables = [
		treeView,
		
		// gui
		vscode.commands.registerCommand('schemaProvider.addSchemas', async () => await provider.addSchemas()),
		vscode.commands.registerCommand('schemaProvider.addJSONs', async () => await provider.addJSONsToSchema()),
		vscode.commands.registerCommand('schemaProvider.addJSONsOnButton', async (schema: SchemaNode) => await provider.addJSONs(schema)),
		vscode.commands.registerCommand('schemaProvider.removeNode', (node: INode) => provider.removeNode(node)),
		vscode.commands.registerCommand('schemaProvider.changeSchema', async () => await provider.changeSchema()),
		vscode.commands.registerCommand('schemaProvider.changeSchemaOnRMB', async (schema: SchemaNode) => await provider.changeSchemaToAnother(schema)),
		
		// Validation commands
		vscode.commands.registerCommand('schemaProvider.validateOne', (node: JSONNode) => provider.validateOne(node)),
		vscode.commands.registerCommand('schemaProvider.validateAll', () => provider.validateAll()),
		vscode.commands.registerCommand('schemaProvider.validateAllAttached', (schema: SchemaNode) => provider.validateAllInSchema(schema)),
	];

	disposables.forEach(x => {context.subscriptions.push(x);});
}

export function deactivate() {}




