export class Scrollable {

    constructor(req, onDo, staticArgs, dynamicArgs) {
        this._req = req;
        this._onDo = onDo;
        this._staticArgs = staticArgs;
        this._dynamicArgs = dynamicArgs;
    }

    get staticArgs() {
        return this._staticArgs;
    }

    set staticArgs(staticArgs) {
        this._staticArgs = staticArgs;
    }

    get dynamicArgs() {
        return this._dynamicArgs;
    }

    set dynamicArgs(dynamicArgs) {
        this._dynamicArgs = dynamicArgs;
    }

    async exec(chunk) {
        this._dynamicArgs = await this._onDo(this._req, chunk, this._staticArgs, this._dynamicArgs);
    }

}
