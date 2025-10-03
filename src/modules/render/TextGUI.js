const textgui = new Module("TextGUI", function() {});
textguifont = textgui.addoption("Font", String, "Poppins");
textguisize = textgui.addoption("TextSize", Number, 14);
textguishadow = textgui.addoption("Shadow", Boolean, true);
textgui.toggle();