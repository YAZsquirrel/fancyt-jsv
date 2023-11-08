import { EventEmitter, Event, TreeItem, TreeItemCheckboxState, TreeItemCollapsibleState, Uri, window, ThemeIcon, ThemeColor } from 'vscode';
import * as path from 'path';
import { INode } from './INode';
import * as fs from 'fs/promises';
import { JSONNode } from './JSONNode';
import AJV, { ValidateFunction } from 'ajv';
import * as MetaSchemaLast from "ajv/dist/refs/json-schema-2020-12";
import { log } from 'console';

export class SchemaNode implements INode {
    private jsons: JSONNode[] = [];
    public readonly collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.Expanded;

    constructor(
        private label: string,
        private path: string
    ) {
        this.ajv.addMetaSchema(MetaSchemaLast);
    }

    get getLabel() {
        return this.label;
    }

    get getPath() {
        return this.path;
    }

    get attachedJsons(): JSONNode[] {
        return this.jsons;
    }

    addJSONsByUris(uris: Uri[]) {
        for (let uri of uris) {
            let isAttached = false;
            for (let json of this.attachedJsons) {
                let jsonPath = json.getPath;
                if (isAttached = jsonPath === uri.fsPath) {
                    window.showInformationMessage(`Json \"${uri.fsPath}\" was already attached to \"${this.label}\"!`);
                    break;
                }
            }

            if (isAttached) { continue; }
            if (this.path === uri.fsPath) {
                window.showWarningMessage(`You can't attach schema to itself: \"${this.label}\"!`);
                continue;
            }
            let json = new JSONNode(path.basename(uri.fsPath), uri.fsPath, this);
            this.attachedJsons.push(json);
        }
    }

    addJSONs(jsons: JSONNode[]) {
        for (let json of jsons) {
            let isAttached = false;
            for (let ajson of this.attachedJsons) {
                let jsonPath = ajson.getPath;
                if (isAttached = jsonPath === json.getPath) {
                    break;
                }
            }

            if (isAttached) { continue; }
            if (this.path === json.getPath) {
                window.showWarningMessage(`You can't attach schema to itself: \"${this.label}\"!`);
                continue;
            }
            json.schema = this;
            this.attachedJsons.push(json);
        }
    }

    changeSchema(label: string, path: string) {
        this.label = label;
        this.path = path;
    }

    getParent(): INode | Promise<INode> | null {
        return null;
    }

    getTreeItem(): TreeItem | Promise<TreeItem> {
        return {
            label: this.label,
            collapsibleState: this.collapsibleState,
            contextValue: 'schemaProvider.tree.schema',
            tooltip: this.path,
            description: 'JSON Schema',
            checkboxState: TreeItemCheckboxState.Unchecked,

            command: {
                command: 'vscode.open',
                title: 'Opens this JSON file',
                arguments: [Uri.file(this.path)]

            },
            iconPath: Uri.file(path.join(__dirname, '../src/media/Schema.svg'))// new ThemeIcon("bracket", new ThemeColor("icon.foreground"))
        };
    }

    getChildren(): INode[] | Promise<INode[]> {
        return this.jsons;
    }

    ajv:AJV = new AJV(
        {
            allErrors : true,
            strict: "log"
        });
    
    private _onDidValidation: EventEmitter< | undefined | void> = new EventEmitter< | undefined | void>();
	readonly onDidValidation: Event< | undefined | void> = this._onDidValidation.event;


    async validateJson(validate: ValidateFunction, jsonnode: JSONNode): Promise<void>
    {
        try 
        { 

            let content = await fs.readFile(jsonnode.getPath);
            let json = JSON.parse(content.toString());
            
            let result = validate(json);
            if (validate.errors && !result){
                window.showWarningMessage(`\'${jsonnode.getLabel}\' is not valid against \'${this.label}\'`);
                log(`\n\'${jsonnode.getLabel}\' is not valid against \'${this.label}\'`);

                validate.errors.forEach(x => log(x));
            }
            else if (result) {
                window.showInformationMessage(`\'${jsonnode.getLabel}\' is valid against \'${this.label}\'`);
            }
        }
        catch (ex) {
            window.showErrorMessage(`Error \'${(ex as Error).message}\'
             occured when tried to validate \'${jsonnode.getLabel}\' against schema \'${this.label}\'.`);
        }
    }
    
    async validateOne(json: JSONNode): Promise<void>
    {
        try {

            let content = await fs.readFile(this.getPath);

            let schema = JSON.parse(content.toString());
            delete schema['$schema'];
            let validate = this.ajv.compile(schema);

            this.validateJson(validate, json);
            
        }
        catch (ex) {
            window.showErrorMessage(`Error \'${(ex as Error).message}\' occured when tried to validate against schema \'${this.label}\'.`);
        }
        
        let errors = this.ajv.errors;
        if (errors) {
            errors.forEach(x => 
                x.message ? 
                window.showErrorMessage(x.message) : 
                `Unknown error occured during validation against schema \'${this.getLabel}\'` );
        }
    }

    async validateAll(): Promise<void>{
        try {

            let content = await fs.readFile(this.getPath);

            let schema = JSON.parse(content.toString());
            delete schema['$schema'];

            let validate = this.ajv.compile(schema);

            this.attachedJsons.forEach(x => this.validateJson(validate, x));
            
        }
        catch (ex) {
            window.showErrorMessage(`Error \'${(ex as Error).message}\' occured when tried to validate against schema \'${this.label}\'.`);
        }
    }
}
