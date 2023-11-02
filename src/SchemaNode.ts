import { InputBoxOptions, TreeItem, TreeItemCheckboxState, TreeItemCollapsibleState, Uri, window } from 'vscode';
import * as path from 'path';
import { INode } from './INode';
import * as fs from 'fs';
import { JSONNode } from './JSONNode';
import AJV from 'ajv';
export const ajv:AJV = new AJV();

export class SchemaNode implements INode {
    private jsons: JSONNode[] = [];
    public readonly collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.Expanded;

    constructor(
        private label: string,
        private path: string
    ) {
        // this.command = {
        //     command: 'vscode.open',
        //     title: 'open selected',
        //     arguments: [file]
        // };
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
            iconPath: path.join(__dirname, '../../src/media/Schema.svg')
        };
    }

    getChildren(): INode[] | Promise<INode[]> {
        return this.jsons;
    }

    async validateAll(): Promise<void> {
        const options: InputBoxOptions = {
            title: "Choose file to validate",
            prompt: "Enter file path",
            placeHolder: "some json file",
            ignoreFocusOut: true
        };

        let input = await window.showInputBox(options);

        if (input === undefined) { return; }

        if (!fs.existsSync(input!)) {
            window.showErrorMessage(`File ${input} not found!`);
            return;
        }


        window.showInformationMessage(input);
        try {

            let content = fs.readFileSync(input);

            let file = JSON.parse(content.toString());
            let errors = ajv.errorsText();

            if (errors.length > 0) {
                window.showErrorMessage(errors);
            }
            window.activeTextEditor?.document.fileName;
            window.showInformationMessage('File succesfully been read.');

        }
        catch (ex) {
            window.showErrorMessage((ex as Error).message);
        }
    }
}
