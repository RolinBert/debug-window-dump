import * as vscode from "vscode";
import * as fs from "fs";
import { DebugProtocol } from '@vscode/debugprotocol';

type Dictionary = {
    [x: string]: string | Object;
};


export class DebugSessionWatcher {
    dbgSession: vscode.DebugSession | undefined;
    frameId: number | undefined;

    requestedVariables: number[] = [];
    dump: Record<string, any> = {};
    promises: Promise<void>[] = [];
    maxHierarchy : number = 10;
    maxReqNr     : number = 1000;
    curReqNr     : number = 0;

    setDbgSession(session: vscode.DebugSession) {
        if (session) {
            this.dbgSession = session;
            console.log(`dbg session ${session}`);
        }
    }

    onReceivedDbgMessage(m: DebugProtocol.ProtocolMessage) {
        if (m.type === 'request') {
            let req = m as DebugProtocol.Request;
            if (req.command === 'scopes') {
                this.frameId = req.arguments["frameId"];
                console.log("frame id set");
            }
        }
    }


    assignVariable(name: string, value: string, parent: Record<string, any>) {
        parent[name] = value;
    }

    isContainerType(typeName: string) {
        return (typeName === 'list' || typeName === 'array' || typeName === 'object' || typeName === 'dict');
    }

    async getVariables(variablesReference: number, parent: Record<string, any>, curHierarchy : number) {
        const response = await this.dbgSession?.customRequest('variables', { variablesReference: variablesReference }).then(result => result, () => ({ response: [] }));
        curHierarchy += 1;
        for (const entry of response.variables) {
            // If the variable has child members and this variable has not yet been visited => go visit it
            if (entry.variablesReference !=0 && this.curReqNr < this.maxReqNr && curHierarchy < this.maxHierarchy) {
                this.curReqNr += 1;
                parent[entry.name] = {};
                try {
                    await this.getVariables(entry.variablesReference, parent[entry.name], curHierarchy);
                } catch (error) {
                    console.log(error);
                }
            } else {
                this.assignVariable(entry.name, entry.value, parent);
            }
        }
    }

    async getDebugVariables() {
        const { scopes } = await this.dbgSession?.customRequest('scopes', { frameId: this.frameId }).then(result => result, () => ({ scopes: [] }));
        this.dump = {};
        this.curReqNr = 0;
        let curHierarchy = 0;
        for (const scope of scopes) {
            if (scope.name === 'Locals') {
                const { variables } = await this.dbgSession?.customRequest('variables', {
                    variablesReference: scope.variablesReference,
                }).then(result => result, () => ({ variables: [] }));
                this.curReqNr += 1;
                for (const entry of variables) {
                    // If the variable has child members and this variable has not yet been visited => go visit it
                    if (entry.variablesReference !=0 && this.curReqNr < this.maxReqNr && curHierarchy < this.maxHierarchy ) {
                        this.dump[entry.name] = {};
                        try {
                            await this.getVariables(entry.variablesReference, this.dump[entry.name], curHierarchy);
                        } catch (error) {
                            console.log(error);
                        }
                    } else {
                        this.assignVariable(entry.name, entry.value, this.dump);
                    }
                }
            } else {
                continue;
            }

        }
        const targetUri = await vscode.window.showSaveDialog({
            filters: {
                json: ["json"], 'All Files': ['*']}});
        if(!targetUri){
            return;
        }
        const writeData = Buffer.from(JSON.stringify(this.dump), 'utf8');
        vscode.workspace.fs.writeFile(targetUri, writeData);
        console.log(this.dump);
    }
}
