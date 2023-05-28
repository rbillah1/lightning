import { Workspace, RunService, TweenService } from "@rbxts/services";
const PrismParts = Workspace.PrismCast.GetChildren();

const CODE = 0;
const CONNECTION = 1;
const SMALL = 1 / math.huge;
const TWO_PI = math.pi * 2;
const RIGHT_ANGLE = math.pi / 2;
const SEED_RANGE = 1000;

const LightningPart = new Instance("Part");
LightningPart.Shape = Enum.PartType.Block;
LightningPart.Anchored = true;
LightningPart.CanCollide = false;
LightningPart.CastShadow = false;
LightningPart.Color = Color3.fromRGB(163, 28, 250);
LightningPart.Material = Enum.Material.Neon;

const CellMesh = Workspace.CellMesh;
interface RectPrismDimensions {
	x: number;
	y: number;
	z: number;
}
interface FBMParams {
	amplitude: number;
	frequency: number;
	octaves: number;
	persistence: number;
	lacunarity: number;
}
function get_center_of_vectors(v1: Vector3, v2: Vector3): Vector3 {
	return v1.add(v2.sub(v1).mul(0.5));
}
function get_rectangular_prism_vertices(dimensions: RectPrismDimensions): Vector3[] {
	return [
		new Vector3(dimensions.x / 2, dimensions.y / 2, -dimensions.z / 2),
		new Vector3(dimensions.x / 2, dimensions.y / 2, dimensions.z / 2),
		new Vector3(-dimensions.x / 2, dimensions.y / 2, -dimensions.z / 2),
		new Vector3(-dimensions.x / 2, dimensions.y / 2, dimensions.z / 2),
		new Vector3(dimensions.x / 2, -dimensions.y / 2, -dimensions.z / 2),
		new Vector3(dimensions.x / 2, -dimensions.y / 2, dimensions.z / 2),
		new Vector3(-dimensions.x / 2, -dimensions.y / 2, -dimensions.z / 2),
		new Vector3(-dimensions.x / 2, -dimensions.y / 2, dimensions.z / 2),
	];
}
function get_rectangular_prism_dimensions(br_corner: Vector3, tl_corner: Vector3): RectPrismDimensions {
	return {
		x: math.abs(br_corner.X - tl_corner.X),
		y: math.abs(br_corner.X - tl_corner.X),
		z: math.abs(br_corner.Z - tl_corner.Z),
	};
}
function is_in_rectangular_prism(zero_relative: Vector3, dimensions: RectPrismDimensions): boolean {
	let available_part;
	for (let i = 0; i < PrismParts.size(); i++) {
		const part = PrismParts[i];
		if (part.GetAttribute("IsUsing")) {
			continue;
		}
		available_part = part;
		available_part.SetAttribute("IsUsing", true);
		break;
	}
	available_part = available_part || Workspace.PlaceholderPart;
	if (!available_part.IsA("BasePart")) {
		return false;
	}
	available_part.Size = new Vector3(dimensions.x, dimensions.y, dimensions.z);
	const origin = new Vector3(SMALL, SMALL, SMALL);
	const cast_params = new RaycastParams();
	cast_params.FilterType = Enum.RaycastFilterType.Include;
	cast_params.FilterDescendantsInstances = [available_part];
	const result = Workspace.Raycast(zero_relative, origin, cast_params);

	if (result && result.Instance === available_part) {
		return true;
	}
	available_part?.SetAttribute("IsUsing", false);
	return false;
}
function evaluate_fbm(x: number, y: number, fbm_params: FBMParams): number {
	let combined = 0;
	for (let i = 0; i < fbm_params.octaves; i++) {
		combined += fbm_params.amplitude * math.noise(x * fbm_params.frequency, y * fbm_params.frequency);
		fbm_params.amplitude *= fbm_params.persistence;
		fbm_params.frequency *= fbm_params.lacunarity;
	}
	return combined;
}
type Connection = RBXScriptConnection | undefined;
type Object = [string, Connection];
const code_order = ["tlf", "trf", "tlb", "tbr", "blf", "brf", "blb", "brb"];
class OctField {
	static oct_field_objects: OctField[] = [];
	private objects: Object[];
	private unused: string[];
	private nests: number;
	private br_corner: Vector3;
	private tl_corner: Vector3;
	private center: Vector3;
	private dimensions: RectPrismDimensions;
	constructor(part: Part, distance: number) {
		this.objects = [];
		this.nests = this.get_recommended_nests(distance);
		[this.br_corner, this.tl_corner] = this.get_corners_of_shape(part);
		this.center = get_center_of_vectors(this.br_corner, this.tl_corner);
		this.dimensions = get_rectangular_prism_dimensions(this.br_corner, this.tl_corner);
		this.unused = [];
		this.permute_wrapper(code_order)(0);
		OctField.oct_field_objects.push(this);
	}
	insert(part: Part) {
		const object: Object = ["", undefined];
		object[CONNECTION] = part.GetPropertyChangedSignal("Position").Connect(() => {
			this.on_changed(part, object);
		});
		this.on_changed(part, object);
	}
	destroy(code: string) {
		const objects = this.objects;
		for (let i = 0; i < objects.size(); i++) {
			const object = this.objects[i];
			if (!(object[CODE] === code)) {
				continue;
			}
			objects.remove(i);
			this.unused.push(code);
		}
	}
	private on_changed(part: Part, object: Object) {
		const pos = part.Position;
		if (!pos) {
			return;
		}
		const previous_code = object[CODE];
		object[CODE] = this.search_box(pos);
		if (!(previous_code === object[CODE])) {
			this.unused.push(previous_code);
		}
	}
	search_box(pos: Vector3): string {
		let code = "";
		let new_center = this.center;
		for (let i1 = 0; i1 < this.nests; i1++) {
			const power = math.pow(2, i1 + 1);
			const dimensions = {
				x: this.dimensions.x / power,
				y: this.dimensions.y / power,
				z: this.dimensions.z / power,
			};
			const vertices = get_rectangular_prism_vertices(dimensions);
			const size = vertices.size();
			for (let i = 0; i < size; i++) {
				vertices[i] = this.center.add(vertices[i]);
			}
			for (let i = 0; i < size; i++) {
				new_center = get_center_of_vectors(new_center, vertices[i]);
				if (!is_in_rectangular_prism(pos.sub(new_center), dimensions)) {
					continue;
				}
				code += code_order[i];
				break;
			}
		}
		return code;
	}
	private get_corners_of_shape(part: Part): [Vector3, Vector3] {
		const vertices = get_rectangular_prism_vertices({
			x: part.Size.X,
			y: part.Size.Y,
			z: part.Size.Z,
		});
		for (let i = 0; i < 8; i++) {
			vertices[i] = vertices[i].add(part.Position);
		}
		let [smallest, largest] = [new Vector3(math.huge), Vector3.zero];
		for (let i = 0; i < 8; i++) {
			const vertex = vertices[i];
			const mag = vertex.Magnitude;
			if (mag < smallest.Magnitude) {
				smallest = vertex;
			} else if (mag > largest.Magnitude) {
				largest = vertex;
			}
		}
		return [smallest, largest];
	}
	private get_recommended_nests(distance: number): number {
		const longest = math.sqrt(
			math.pow(this.tl_corner.X - this.br_corner.X, 2) +
				math.pow(this.tl_corner.Y - this.br_corner.Y, 2) +
				math.pow(this.tl_corner.Z - this.br_corner.Z, 2),
		);
		return math.ceil(math.log(longest / distance, 2)); // longest / 2^x < distance
	}
	private permute_wrapper(str_array: string[]) {
		const length = str_array.size();
		const last = length - 1;
		const data: string[] = [];
		const permute = (idx: number) => {
			for (let i = 0; i < length; i++) {
				data[idx] = str_array[i];
				if (idx === last) {
					this.unused.push(data.reduce((accumulator, current) => accumulator + current));
				} else {
					permute(idx + 1);
				}
			}
		};
		return permute;
	}
}
interface LightningParams {
	vertex_count: number;
	funkiness?: number;
	radius?: number;
	cycle_rate?: number;
	cycles?: number;
	color_range?: Color3[];
	color_speed?: number;

	noise_increment?: number;
	fbm_params: FBMParams;
	part_one: Part;
	part_two: Part;
}
export class Lightning {
	static lightning_objects: Lightning[] = [];
	static lightning_clock: number = os.clock();
	private vertices: Vector3[];
	private vertex_count: number; // #vertices
	private funkiness = 0.5; // [0, 1]
	private radius = 0; // [0, infinite)
	private cycle_rate = 4; // (0, 6)
	private cycles = 0; // (0, 0.5 * vertex_count)
	private cycle_increment = 0;

	private noise_increment = 0.15;
	private noise_value = 0;
	private x_seed = math.random(1, SEED_RANGE) / 10;
	private y_seed = math.random(1, SEED_RANGE) / 10;
	private z_seed = math.random(1, SEED_RANGE) / 10;
	private fbm_params;
	color_range = [LightningPart.Color];
	color_speed = 1;

	private is_spawn = true;
	part_one: Part;
	part_two: Part;
	private parts: Part[] = [];
	constructor(params: LightningParams) {
		this.vertices = [];
		this.vertex_count = params.vertex_count;
		this.funkiness = params.funkiness || this.funkiness;
		this.radius = params.radius || this.radius;
		this.cycles = params.cycles || this.cycles;
		this.cycle_rate = math.rad(params.cycle_rate || this.cycle_rate);
		this.noise_increment = params.noise_increment || this.noise_increment;
		this.color_range = params.color_range || this.color_range;
		this.color_range.push(this.color_range[0]);

		this.fbm_params = params.fbm_params;
		this.part_one = params.part_one;
		this.part_two = params.part_two;
		Lightning.lightning_objects.push(this);
	}
	private visualize_parts() {
		const parts = this.parts;
		const vertices = this.vertices;
		let size = parts.size();
		if (size === 0) {
			for (let i = 0; i < vertices.size() - 1; i++) {
				const bolt = LightningPart.Clone();
				bolt.Parent = Workspace;
				parts[i] = bolt;
			}
			size = parts.size();
		}
		for (let i = 0; i < size; i++) {
			const part = parts[i];
			const current = vertices[i];
			let following = vertices[i + 1];
			if (!following) {
				following = this.part_two.Position;
			}
			part.CFrame = CFrame.lookAt(get_center_of_vectors(current, following), following).mul(
				CFrame.Angles(0, RIGHT_ANGLE, 0),
			);
			part.Size = new Vector3(following.sub(current).Magnitude, 0.5, 0.5);
		}
	}
	private reset_angle_offset() {
		const next_increment = this.cycle_increment + this.cycle_rate;
		if (next_increment > TWO_PI) {
			this.cycle_increment = next_increment % TWO_PI;
			return;
		}
		this.cycle_increment = next_increment;
	}
	private map_rotation() {
		const vertices = this.vertices;
		const cf = this.part_one.CFrame;
		const pos = cf.Position;
		const down = cf.UpVector.mul(-1);
		const mag = pos.sub(this.part_two.Position).Magnitude;
		let direction = 1;
		if (pos.Y < this.part_two.Position.Y) {
			direction = -1;
		}
		for (let i = 0; i < vertices.size(); i++) {
			const vertex = vertices[i];
			vertices[i] = pos
				.add(cf.RightVector.mul(direction * (vertex.X - pos.X)))
				.add(down.mul(math.abs(pos.Y - vertex.Y)))
				.add(cf.LookVector.mul(direction * (vertex.Z - pos.Z)));
		}
	}
	update() {
		const vertices = this.vertices;
		const size = this.vertex_count;
		const radius = this.radius;
		const funkiness = this.funkiness;
		const cycle_increment = this.cycle_increment;
		const is_cyclic = this.cycles > 0;

		const verts_per_cycle = (is_cyclic && math.ceil(size / this.cycles)) || 1;
		const angle_offset = TWO_PI / verts_per_cycle;
		let y_offset = -(this.part_one.Position.sub(this.part_two.Position).Magnitude / size);
		const part_one_y = this.part_one.Position.Y;
		if (part_one_y < this.part_two.Position.Y) {
			y_offset *= -1;
		}
		for (let i = 1; i < size - 1; i++) {
			vertices[i - 1] = new Vector3(
				this.part_one.Position.X + evaluate_fbm(this.noise_value, this.x_seed, this.fbm_params),
				part_one_y + y_offset * i + evaluate_fbm(this.noise_value, this.y_seed, this.fbm_params),
				this.part_one.Position.Z + evaluate_fbm(this.noise_value, this.z_seed, this.fbm_params),
			);
			this.noise_value += this.noise_increment;
			if (!is_cyclic) {
				continue;
			}
			const current_offset = angle_offset * (i % verts_per_cycle);
			const previous = vertices[i - 1];
			vertices[i - 1] = new Vector3(
				previous.X + radius * math.cos(current_offset - cycle_increment),
				previous.Y,
				previous.Z + radius * math.sin(current_offset - cycle_increment),
			);
		}
		this.x_seed += this.noise_increment / 2;
		this.y_seed += this.noise_increment / 2;
		this.z_seed += this.noise_increment / 2;
		this.noise_value = 0;
		this.map_rotation();
		this.visualize_parts();
		if (is_cyclic) {
			this.reset_angle_offset();
		}
		this.is_spawn = false;
	}
}
export class LightningField {}
RunService.Heartbeat.Connect(() => {
	for (let i = 0; i < Lightning.lightning_objects.size(); i++) {
		Lightning.lightning_objects[i].update();
	}
});
