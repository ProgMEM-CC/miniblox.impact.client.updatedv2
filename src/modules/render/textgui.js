/**
 * TextGUI Module
 */

const textgui = new Module("TextGUI", function() {});
textguifont = textgui.addoption("Font", String, "Arial");
textguisize = textgui.addoption("TextSize", Number, 15);
textguishadow = textgui.addoption("Shadow", Boolean, true);
textgui.toggle();
