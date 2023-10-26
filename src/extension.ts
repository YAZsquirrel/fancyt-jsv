import * as vscode from 'vscode';
import * as JList from './JList';


export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "FancyT JSV" is now active!');
	let disposable = [
		vscode.commands.registerCommand('fancyt-jsv.chooseSchema', JList.chooseSchema),
		vscode.commands.registerCommand('fancyt-jsv.validateJson', JList.validateAllJson),
		vscode.commands.registerCommand('fancyt-jsv.validateChosen', JList.validateChosen)
	];

	disposable.forEach(x => {context.subscriptions.push(x);});
}

export function deactivate() {}




