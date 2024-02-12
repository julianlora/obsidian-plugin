import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { syntaxTree } from "@codemirror/language";
import {
  Extension,
  RangeSetBuilder,
  StateField,
  Transaction,
} from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";
import { text } from 'stream/consumers';

// CREATE WIDGET ELEMENT
export class AnnotationWidget extends WidgetType {
	private text: string;

    constructor(text: string) {
        super();
        this.text = text;
    }

	toDOM(view: EditorView): HTMLElement {
		const div = document.createElement("div");

		div.innerText = this.text;
		div.className = "annotation"

		return div;
	}
}

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	private view = new EditorView()
	private cursorNodeIndex = 0

	private isCursorOnAnnotation(view: EditorView, searchText: string){
		const cursorPos = view.state.selection.main.head
		const textAtCursor = view.state.sliceDoc(cursorPos, cursorPos + searchText.length)
		// console.log(textAtCursor)

		return textAtCursor === searchText
	}

	async onload() {
		await this.loadSettings();

		// Almacenar referencia a this para usarla en el callback
		const self = this;

		// Actualizar posicion del cursor por teclado
		this.registerDomEvent(document, "keydown", () => {
			const selection = document.getSelection()
			if (selection){
				self.cursorNodeIndex = selection.anchorOffset
			}
		})
		// Actualizar posicion del cursor por mouse
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			const selection = document.getSelection()
			if (selection){
				self.cursorNodeIndex = selection.anchorOffset
			}
		});


		//Register state field
		this.registerEditorExtension(StateField.define<DecorationSet>({
			// DEFINE STATE FIELD
			create(state): DecorationSet {
				  return Decoration.none;
			},
			update(oldState: DecorationSet, transaction: Transaction): DecorationSet {
				const builder = new RangeSetBuilder<Decoration>();
			
				syntaxTree(transaction.state).iterate({
					enter(node) {
						// Itera por nota o documento
						if (node.type.name === "Document"){
							// Obtener texto del nodo
							const nodeText = transaction.state.sliceDoc(node.from, node.to);

							// Dividir el texto en líneas o párrafos
							const paragraphs = nodeText.split('\n');  // Puedes ajustar esto según la estructura de tu documento

							// Ahora 'paragraphs' es un array que contiene los párrafos aislados
							for (const paragraph of paragraphs) {
								// Identificar comando en el párrafo
								const index = paragraph.indexOf("::");
								if (index !== -1) {
									// Obtiene el texto que sigue a la cadena "::"
									const textoSiguiente = paragraph.slice(index + 2, paragraph.length);

									// Identificar el párrafo donde se encuentra el cursor y si el cursor esta sobre el comando
									const selection = document.getSelection()
									const selectionText = selection?.anchorNode?.textContent
									if(!(selectionText == paragraph.slice(0, paragraph.length - textoSiguiente.length - 2) && self.cursorNodeIndex == selectionText.length)){
										// Encontrar index del comando a nivel del documento general
										const nodeIndex = nodeText.indexOf(paragraph) + paragraph.length - textoSiguiente.length - 2
										// Mover texto
										builder.add(
											nodeIndex,
											nodeIndex + textoSiguiente.length + 2,
											Decoration.replace({
												widget: new AnnotationWidget(textoSiguiente),
											})
										);
									}

								}

							}

			
							// esto es para agregar botón
							// if (node.type.name.includes("Document")) {
							// 	builder.add(
							// 		node.to,
							// 		node.to + 1,
							// 		Decoration.replace({
							// 		widget: new EmojiWidget(),
							// 		})
							// 	);
							// }
						}
					},
				})
				return builder.finish();
				
			},
			provide(field: StateField<DecorationSet>): Extension {
				  return EditorView.decorations.from(field);
			},
		}));

		

		

		// Access content in file
		this.app.workspace.on('active-leaf-change', async () => { // --> listener for obsidian events
			const file = this.app.workspace.getActiveFile() // --> if this is not inside the listener, there will never be an active file before finishing onload
			if (file){
				let content = await this.app.vault.read(file)
				let nuevo = content.replace(/::([^]*?)\n/g, ":: Nuevo texto reemplazado\n")
			}
			
			


		})
		
	
		// CONTENT UPDATES
		this.app.workspace.on('editor-change', editor => { // listener changes
			const content = editor.getDoc().getValue() // content updated
			// work with new content, sent it to method

		})

		

		this.addCommand({
			id: "convert-to-uppercase",
			name: "Convert to uppercase",
			editorCallback: (editor: Editor) => {
			  const selection = editor.getSelection();
			  editor.replaceSelection(selection.toUpperCase());
			},
		});


		//-----------------------------------------------------------------------------------------
		

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
