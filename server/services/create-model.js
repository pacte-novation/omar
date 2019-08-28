import * as tf from '@tensorflow/tfjs';

const createModel = (inputShape) => {
    return new Promise((resolve, reject) => {
        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 128, activation: 'relu', inputShape: inputShape }));
        model.add(tf.layers.dropout({ rate: 0.2 }));
        model.add(tf.layers.dense({ units: 256, activation: 'relu' }));
        model.add(tf.layers.dropout({ rate: 0.2 }));
        model.add(tf.layers.dense({ units: 256, activation: 'relu' }));
        model.add(tf.layers.dropout({ rate: 0.2 }));
        model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
        model.add(tf.layers.dropout({ rate: 0.1 }));
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
        model.compile({ optimizer: 'sgd', loss: 'meanSquaredError' });
        resolve(model);
    })
}

export { createModel };