import { TextDocument, InputBoxOptions, window, TextDocumentContentChangeEvent, commands, workspace } from 'vscode'; 
//import * as vscode from 'vscode'; 
import * as fs from 'fs';

// eslint-disable-next-line @typescript-eslint/naming-convention
import AJV from 'ajv';
import exp = require('constants');

const ajv:AJV = new AJV();
let chosenSchema: TextDocument | undefined; 
let jsonList: TextDocument[] | undefined;
let chosenSchemaSetToAutovalidate: boolean = false;
let onJsonChanged: TextDocumentContentChangeEvent | undefined;

const options:InputBoxOptions = {
    title: "Choose file to validate",
    prompt: "Enter file path",
    placeHolder: "some json file",
    ignoreFocusOut: true 
};


export async function validateAllJson()
{
    let input = await window.showInputBox(options);
    
    if (input === undefined) {return;} 
    
    if (!fs.existsSync(input!))
    {
        window.showErrorMessage(`File ${input} not found!`);
        return;
    }


    window.showInformationMessage(input);
    try {
        
        let content = fs.readFileSync(input);
        
        let file = JSON.parse(content.toString());
        let errors = ajv.errorsText();

        if (errors.length > 0)	
        {
            window.showErrorMessage(errors);
        }
        window.activeTextEditor?.document.fileName;
        window.showInformationMessage('File succesfully been read.');

    } 
    catch (ex) {
        window.showErrorMessage((ex as Error).message);
    }
}

export async function validateChosen() 
{
	window.showInformationMessage('chosen');
    //let smt = commands.executeCommand('vscode.editorChat.start');

    console.log(chosenSchema?.fileName);
}

export function chooseSchema()
{
    chosenSchema = window.activeTextEditor?.document;


}