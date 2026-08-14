# LedFx Flow Documentation

## Introduction

Welcome to the LedFx Flow view! This powerful feature provides a node-based interface for visually routing effects and scenes to your virtual devices. It allows for complex and dynamic lighting setups that go beyond simple presets. Instead of applying an effect to a single virtual, you can create intricate graphs of senders (like effects and scenes) and receivers (your virtuals) to build truly unique experiences.

## The Canvas

The Flow view is a canvas where you can add, connect, and manage different types of nodes.

### Nodes

Nodes are the fundamental building blocks of your flow. There are several types of nodes, each with a specific purpose.

*   **Omni FX (Global Sender)**: This is a special, pre-existing node that sends its color and effect settings to **all** virtuals on your LedFx instance that are not connected to any other sender. It acts as a global default. You cannot create new Omni FX nodes, and it cannot be connected to other nodes via edges.

*   **Scoped Omni FX (Sender)**: You can add this node to send color and effect settings to a specific, targeted group of virtuals. Unlike the global Omni FX, you can draw connections from a Scoped Omni FX node to one or more Virtual nodes.

*   **Effect Sender (Sender)**: This node is similar to the Scoped Omni, but it is designed to send a single, specific effect's configuration to the virtuals it's connected to.

*   **Virtual (Receiver)**: Each of your virtual devices is represented as a Virtual node. These nodes act as receivers. When you connect a sender node to a Virtual node, that virtual will start receiving and displaying the effect from the sender.

*   **Scene (Sender)**: Each of your saved scenes can be added to the canvas as a Scene node. Activating a Scene node will apply the scene's configuration to all connected virtuals.

*   **Pad Grid (Sender)**: A grid of one-tap colour pads. Tapping a pad tints the effects running on the connected virtuals; tapping the lit pad again (or the `Clear` button) puts the original colours straight back. See [Pad Grid](#pad-grid) below.

### Edges

Edges are the lines you draw between nodes. They represent the flow of effect data from a sender node to a receiver node. To create an edge, simply click and drag from the handle on the right side of a sender node to the handle on the left side of a receiver node.

## Core Concepts

*   **Senders & Receivers**: The fundamental principle of the Flow is the relationship between Senders and Receivers. Senders (Omni, Effect, Scene nodes) generate effect data. Receivers (Virtual nodes) consume that data and display the effect.

*   **Automatic Syncing**: By default, Effect Sender nodes have an "Auto Sync" feature enabled (indicated by a glowing icon). When active, any change you make to the effect's settings will be instantly sent to all connected virtuals. You can toggle this feature off. When off, the "Play" button on the node can be used to trigger a one-time manual sync of the current settings.

*   **Collapsing Nodes**: To keep your canvas clean and organized, all sender nodes can be collapsed to hide their detailed settings. They start in a collapsed state by default. Simply click the collapse/expand icon in the node's header to toggle its state.

## Pad Grid

The Pad Grid is built for live use: you want to wash the room in a colour for a
chorus and then get the show back, without editing anything.

It differs from the other senders in one important way. The Omni and Effect
senders **change** the effect: the new colour is written into the effect's
config and saved, so the previous colour is gone. A pad grid applies an
**override** instead — the effect keeps running underneath, untouched, and
clearing the override reveals it again exactly as it was. Overrides are not
saved to the LedFx config and do not survive a restart of the core.

Because it is an override rather than a config change, it also works on effects
that have no colour setting at all (Energy, for example): those are recoloured
as they are rendered, keeping their brightness animation so beats still read.

### Using it

*   **Add one**: right-click the canvas → `Sender` → `Pad Grid`, or use the
    `Add Pad Grid` button in the toolbar. Give it a name.
*   **Choose its targets**: drag from the handle on its right edge to the Virtual
    nodes you want it to control. The globe/hub button in the node header
    switches between *connected virtuals only* and *all virtuals*.
*   **Tap a pad** to apply that colour. The pad shows `ON`. Tap it again, tap
    `Clear`, or tap a different pad to change.
*   **Edit the pads**: click the pencil in the node header. In edit mode you can
    resize the grid, change the pad size, and click any pad to open a colour or
    gradient picker. Click the pencil again to go back to live mode.

Pads are stored with the node, so they are included in saved layouts, exports
and imports along with everything else on the canvas.

Because override state lives in the LedFx core rather than the browser, a pad
lit on one device shows as lit on every other device pointed at the same core.

## How-To Guides

### Adding and Removing Nodes

*   **To Add a Node**: Right-click anywhere on the canvas to open the context menu. From here you can:
    *   Add a `Scoped Omni`, `Effect` or `Pad Grid` sender via the "Sender" submenu. You will be prompted to give the new node a name.
    *   Add a `Scene` via the "Sender" -> "Scene" submenu.
    *   Add a `Virtual` that isn't already on the canvas via the "Receiver" submenu.
*   **To Remove a Node**: Select the node you wish to remove and press the `Delete` or `Backspace` key.

### Connecting and Disconnecting Nodes

*   **To Connect Nodes**: Click and drag from the small circle (handle) on the right edge of a sender node to the handle on the left edge of a receiver node.
*   **To Disconnect Nodes**: Select the edge (the line between two nodes) and press the `Delete` or `Backspace` key.

### Managing Layouts

The Flow view includes a robust system for saving and managing your layouts.

*   **Default**: Resets the canvas to the default layout, which includes the Global Omni FX node and all of your available virtuals and scenes.
*   **Saved Layouts**: Any layouts you save will appear as named buttons.
    *   **Left-click** a layout button to load it.
    *   **Right-click** a layout button to delete it permanently.
*   **+ (Save)**: Click the `+` button to save your current node arrangement. You will be prompted to enter a name for the layout.
*   **Import/Export**: You can save your flow to a `.json` file on your computer using the `Export` button and load it back later using the `Import` button. This is useful for backing up complex flows or sharing them with others.

## Example Workflow: Creating a Simple Effect Flow

1.  **Start with a clean slate**: If you have nodes on your canvas, you can clear them by clicking the `Default` button to reset.
2.  **Add an Effect Sender**: Right-click the canvas, go to `Sender` -> `Effect`, and give your new node a name (e.g., "My Rainbow Effect").
3.  **Configure the Effect**: Expand the new node. Select an effect from the dropdown (e.g., "gradient") and configure its colors and settings as desired.
4.  **Connect to a Virtual**: Drag a connection from the handle on your "My Rainbow Effect" node to the handle on one of your Virtual nodes.
5.  **Observe**: The virtual you connected should now be displaying the rainbow effect. Because auto-sync is on by default, any further changes you make to the effect sender will be reflected on the virtual in real-time.
6.  **Save your work**: Click the `+` button, give your layout a name like "Simple Rainbow", and save it for next time!