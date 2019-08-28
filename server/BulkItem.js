class BulkItem {

    constructor(actionStr, targetObj, docId = '', indexStr = '') {
        this._docId = docId;
        this._actionStr = actionStr;
        this._indexStr = indexStr;
        this._targetObj = targetObj;
    }

    toStr() {
        let actionObj = { [this._actionStr]: {} }
        if (this._indexStr !== '') { actionObj[this._actionStr] = Object.assign(actionObj[this._actionStr], { _index: this._indexStr }); }
        if (this._docId !== '') { actionObj[this._actionStr] = Object.assign(actionObj[this._actionStr], { _id: this._docId }); }

        const bulkItemStr = [actionObj, this._targetObj].map(obj => JSON.stringify(obj)).join('\n');
        return bulkItemStr
    }

}

export { BulkItem }