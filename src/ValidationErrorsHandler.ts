/* eslint-disable curly */
import { ErrorObject } from "ajv";
import { JSONNode } from "./JSONNode";
import { SchemaNode } from "./SchemaNode";
import { window, Uri, ExtensionContext, CancellationError } from "vscode";
import * as vscode from 'vscode';
import { log } from "console";
import { sleep } from "./tools";

export class ValidationErrorsHandler implements vscode.Disposable
{
    constructor(private schema?: SchemaNode, private jsons?: JSONNode[])
    {
        this.subscribeToDocUpdate();
    }

    dispose() {
        this.cts.dispose();
    }

    static validateOnChange: boolean = false; 

    public set setJsons(value: JSONNode[]) {
        this.jsons = value;
    }

    public set setSchema(value: SchemaNode) {
        this.schema = value;
    }

    static context: ExtensionContext;

    public static set setContext(value: ExtensionContext){
        ValidationErrorsHandler.context = value;
        
    }

    cts: vscode.CancellationTokenSource = new vscode.CancellationTokenSource();
    private subscribeToDocUpdate() {
        ValidationErrorsHandler.context?.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument((args) => {
                
                this.cts.cancel();
                this.cts.dispose();
                this.cts = new vscode.CancellationTokenSource();

                this.onUserChange(args?.document.uri, this.cts.token)
                     .catch((x) => {
                         log((x as Error).message);
                     }); 
                
            }, this)
        );
    }

    private async onUserChange(uri: Uri, token: vscode.CancellationToken) 
    {
        await sleep(250);

        if (token.isCancellationRequested)
            throw new vscode.CancellationError();

        if (ValidationErrorsHandler.validateOnChange) {

            if (this.schema?.getUri.fsPath === uri.fsPath) {
                await this.schema?.update(this.cts.token);

            }
            else if (this.schema?.attachedJsons.some(x => x.getUri.fsPath === uri.fsPath)) {
                let json = this.schema?.attachedJsons.find(x => x.getUri.fsPath === uri.fsPath);
                await json?.parse();
                await this.schema?.validateOne(json!, this.cts.token);

            }
        }
    }
    onSchemaChange()
    {
        this.clearErrors();
    }

    public clearErrors()
    {
        this.collection.clear();
    }

    public clearJsonErrors(uri: Uri)
    {
        this.collection.delete(uri);
    }

    private collection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection('validation');

    async updateDiagnostics(errors: ErrorObject[], uri: Uri, token: vscode.CancellationToken | undefined): Promise<void> 
    {
        this.clearJsonErrors(uri);
        log(errors);

        let errorDiagnostics: vscode.Diagnostic[] = [];
        let td = await vscode.workspace.openTextDocument(uri); //?
        
        if (token && token?.isCancellationRequested)
            //return Promise.reject().catch(() => log('got to updateDiagnostics'));
            throw new CancellationError();

        errors.forEach(e => {
            let errorMessage = `Error: \'${typeof e.data === 'string' ? e.data : e.instancePath}\' - ${e.message}, at path \'${e.instancePath}\'.`;
            if (td.isClosed)
            {
                window.showErrorMessage(errorMessage);
                return;
            }

            let path = e.instancePath.slice(1, e.instancePath.length).split("/");
            
            let range = typeof e.data === 'string' ? 
                        this.getRangeInJson(td, path, e.data) : 
                        this.getRangeInJson(td, path, JSON.stringify(e.data));

            errorDiagnostics.push({
                code: '',
                message: errorMessage,
                range: range,
                severity: vscode.DiagnosticSeverity.Error,
                source: ''
            });
        });
        this.collection.set([[uri, errorDiagnostics], ]);
    }

    getRangeInJson(json: vscode.TextDocument, path: string[], data: string): vscode.Range {
        
        let pos1: vscode.Position;
        let pos2: vscode.Position;

        let text = json.getText();
        let pointer = 0;
        let counter = 0;
        
        path.forEach(p => {
            text = text.slice(pointer, text.length);
            counter += pointer = text.search(p);
        });

        text = text.slice(pointer, text.length);

        let dataStartPtr = counter + text.search(data);

        pos1 = json.positionAt(counter - 1);
        pos2 = json.positionAt(dataStartPtr + data.length + 1);

        return new vscode.Range(pos1, pos2);
    }
    
    async handleSchemaErrors(errors: ErrorObject[] | null | undefined, token: vscode.CancellationToken | undefined): Promise<void>
    {
        if (!errors) {
            this.clearJsonErrors(this.schema!.getUri);
            return;
        }
        vscode.window.showErrorMessage(`Some errors occured while tried to parse schema \'${this.schema!.getLabel}\'`);
        if (this.schema) 
        {
            if (token && token?.isCancellationRequested)
                //return;
                throw new CancellationError();

            await this.updateDiagnostics(errors, this.schema!.getUri, token);
        }
        else 
        {
            throw new Error(`Tried to validate unexisting schema`);
        }
    }

    async handleJsonErrors(json: JSONNode, errors: ErrorObject[] | null | undefined, token: vscode.CancellationToken | undefined)
    {
        if (errors)
        {
            if (token && token?.isCancellationRequested)
                //return;
                throw new CancellationError();
            
            this.updateDiagnostics(errors, json.getUri, token);
            //errors.forEach(x => console.log(x));
        }
        else 
        {
            this.collection.delete(json.getUri);
            window.showInformationMessage(`\'${json.getLabel}\' is valid against \'${this.schema!.getLabel}\'`);
        }
    }


}


