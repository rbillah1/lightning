import { UserInputService, Players } from "@rbxts/services";
const player = Players.LocalPlayer;
const character = player.Character || player.CharacterAdded.Wait()[0];
const humanoid = character.WaitForChild("Humanoid");

if (humanoid && humanoid.IsA("Humanoid")) {
	let is_sprinting = false;
	UserInputService.InputBegan.Connect((input, gpe) => {
		if (gpe) {
			return;
		}
		if (input.KeyCode === Enum.KeyCode.X) {
			is_sprinting = !is_sprinting;
			humanoid.WalkSpeed = (is_sprinting && 32) || 16;
		}
	});
}
