import { EventEmitter, Event, TreeItem, TreeItemCheckboxState, TreeItemCollapsibleState, Uri, CancellationToken, workspace } from 'vscode';
import * as path from 'path';
import { INode } from './INode';
import { SchemaNode } from './SchemaNode';
import * as fs from 'fs/promises';

export class JSONNode implements INode {
    public readonly collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None;
    private _jsonChanged: EventEmitter<void> = new EventEmitter<void>();
    readonly jsonChanged: Event<void> = this._jsonChanged.event;
    
    constructor(
        private label: string,
        private path: string,
        public schema: SchemaNode
        
    ) {
        this.parse();
    }

    get getLabel(){
        return this.label;
    }

    get getPath()
    {
        return this.path;
    }

    get getUri() {
        return Uri.file(path.join(this.path));
    }

    get getSchema(): SchemaNode
    {
        return this.schema;
    }

    async validate(){
        await this.schema.validateOne(this, undefined);
    }

    private json: any;

    get getJson(): any
    {
        return this.json;
    }

    async parse(){
        if (!this.path) {throw new Error(`File \'${this.path}\' does not exist`);}
        
        let content = await fs.readFile(this.getPath);
        let text = workspace.textDocuments.find(x => x.uri.fsPath === this.getPath)?.getText() ?? content.toString();

        this.json = JSON.parse(text);
    }

    getParent(): INode | Promise<INode> {
        return this.schema;
    }
    getTreeItem(): TreeItem | Promise<TreeItem> {
        return {
            label: this.label,
            collapsibleState: this.collapsibleState,
            contextValue: 'schemaProvider.tree.json',
            tooltip: this.path,
            description: 'JSON file',
            command: {
                command: 'vscode.open',
                title: 'Opens this JSON file',
                arguments: [Uri.file(this.path)]
                
            },
            //checkboxState: TreeItemCheckboxState.Unchecked,

            iconPath: path.join(__dirname, "../src/media/Json.svg")
        };
    }
    getChildren(): INode[] | Promise<INode[]> {
        return [];
    }
}


