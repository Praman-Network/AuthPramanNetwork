pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * @title FaceDistanceVerify
 * @notice Verifies that the squared Euclidean distance between two quantized vectors of dimension n is below a threshold.
 * @param n The dimension of the vector (default: 128).
 * @param threshold The maximum allowed squared Euclidean distance (e.g. 0.36 * 10^10 = 3600000000).
 */
template FaceDistanceVerify(n, threshold) {
    signal input newVector[n];
    signal input savedVector[n];
    signal output isMatch;

    signal diff[n];
    signal diffSquare[n];
    signal sum[n];

    // Compute squared differences
    diff[0] <== newVector[0] - savedVector[0];
    diffSquare[0] <== diff[0] * diff[0];
    sum[0] <== diffSquare[0];

    for (var i = 1; i < n; i++) {
        diff[i] <== newVector[i] - savedVector[i];
        diffSquare[i] <== diff[i] * diff[i];
        sum[i] <== sum[i-1] + diffSquare[i];
    }

    // Instantiate LessThan comparator
    // LessThan takes inputs of bit-width up to 252 (BN254 field constraint)
    component lt = LessThan(252);
    lt.in[0] <== sum[n-1];
    lt.in[1] <== threshold + 1; // Less than or equal to threshold

    isMatch <== lt.out;
    isMatch === 1; // Constraint: must be a match (isMatch == 1)
}

component main {public [savedVector]} = FaceDistanceVerify(128, 3600000000);
