import * as vscode from "vscode";
import { DebugProtocol } from '@vscode/debugprotocol';
export class DebugSessionWatcher {
    dbgSession: vscode.DebugSession | undefined;
    frameId: number | undefined;

    requestedVariables: number[] = [];
    dump: Record<string, any> = {};
    promises: Promise<void>[] = [];
    maxHierarchy: number = 10;

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

    isIterable(obj: any) {
        if (obj === null) {
            return false;
        }
        return typeof obj[Symbol.iterator] === 'function';
    }

    async getVariables(variablesReference: number, parent: Record<string, any>, curHierarchy: number) {
        const response = await this.dbgSession?.customRequest('variables', { variablesReference: variablesReference }).then(result => result, () => ({ response: [] }));
        if(response !== null && this.isIterable(response.variables))
        {
            curHierarchy += 1;
            for (const entry of response.variables) {
                // If the variable has child members and this variable has not yet been visited => go visit it
                if (entry.variablesReference !== 0 && entry.type !== '' && curHierarchy < this.maxHierarchy) {
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

    }

    async getDebugVariables() {
        this.dump = {};
        let curHierarchy = 0;

        this.maxHierarchy = vscode.workspace.getConfiguration("debug-window-dump").get("maxHierarchies", 10);
        const { scopes } = await this.dbgSession?.customRequest('scopes', { frameId: this.frameId }).then(result => result, () => ({ scopes: [] }));
        if(this.isIterable(scopes))
        {
            for (const scope of scopes) {
                if (scope.name === 'Locals') {
                    const { variables } = await this.dbgSession?.customRequest('variables', {
                        variablesReference: scope.variablesReference,
                    }).then(result => result, () => ({ variables: [] }));
                    if(this.isIterable(variables))
                    {
                        for (const entry of variables) {
                            // If the variable has child members and this variable has not yet been visited => go visit it
                            if (entry.variablesReference !== 0 && entry.type !== '' && curHierarchy < this.maxHierarchy) {
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
                    }
                } else {
                    continue;
                }

            }
        }
        const targetUri = await vscode.window.showSaveDialog({
            filters: {
                json: ["json"], 'All Files': ['*']
            }
        });
        if (!targetUri) {
            return;
        }
        const writeData = Buffer.from(JSON.stringify(this.dump), 'utf8');
        vscode.workspace.fs.writeFile(targetUri, writeData);
        console.log(this.dump);
    }
}
