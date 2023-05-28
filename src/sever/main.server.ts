import { Lightning } from "./lightning";
import { Workspace } from "@rbxts/services";
const object = new Lightning({
	vertex_count: 50,
	funkiness: 5,
	radius: 2.5,
	cycle_rate: 12,
	cycles: 0,
	color_range: [Color3.fromRGB(237, 255, 69), Color3.fromRGB(66, 255, 120)],
	fbm_params: {
		amplitude: 1.15,
		frequency: 1,
		octaves: 3,
		persistence: 1,
		lacunarity: 1,
	},

	part_one: Workspace.Bolt.PartOne,
	part_two: Workspace.Bolt.PartTwo,
});
