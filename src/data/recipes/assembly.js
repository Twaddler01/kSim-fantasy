// src/data/assembly.js

export const assemblyRecipes = [
    {
        id: "assembleRunedDagger",
        name: "Assemble Runed Dagger",
        description:
            "Bind a void shard into a steel blade. The runes are not decorative.",
        unlockId: "forgeMastery",
        inputs: {
            steelIngot: 1,
            voidShard: 1,
            moonbloom: 2
        },
        outputs: {
            runedDagger: 1
        },
        durationSeconds: 45,
        unique: true
    }
];
