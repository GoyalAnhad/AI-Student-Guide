    import * as tf from "@tensorflow/tfjs-node";

    const model = tf.sequential();

    model.add(tf.layers.dense({ units: 10, inputShape: [3], activation: "relu" }));
    model.add(tf.layers.dense({ units: 3, activation: "softmax" }));

    model.compile({
    optimizer: "adam",
    loss: "categoricalCrossentropy",
    });

    export function predict(input) {
    return model.predict(tf.tensor2d([input])).arraySync();
    }