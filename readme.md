# Automatic compression of new files to single file
This is a simple utility CLI tool to watch specified folder and automatically compress new pdf's into a file with specified name, deleting the old file automatically.

I have used it personally to compress CV's exported via Figma (big files) by watching the download folder and decided that somebody could also benefit this.

For it to work it requires [GhostScript](https://ghostscript.com/) with specified PATH env variable set to its bin folder.

If the gs command is not recognized despite setting the env variable with ghostscript executable, then make a shortcut to it setting the name to gs.exe .