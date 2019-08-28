import expect from '@kbn/expect';
import { oneHot } from '../utils';

describe('oneHot', () => {
    it('tests the output of the function', () => {
        const input = { header: "fruits", values: ["banane", "pomme", "orange", "pomme", "pomme"] };
        const expected = [
            { header: "fruits_banane", values: [1, 0, 0, 0, 0] },
            { header: "fruits_pomme", values: [0, 1, 0, 1, 1] },
            { header: "fruits_orange", values: [0, 0, 1, 0, 0] }
        ]
        const output = oneHot(input);
        expect(JSON.stringify(output)).to.equal(JSON.stringify(expected));
    });
});