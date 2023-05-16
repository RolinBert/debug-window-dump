# debug-window-dump README

This extension reads out the debugger state when the debugger is paused.
It dumps the content of the local window into a JSON file.

## How to use the extension

Just start the debugger of your choice (Python, C++, ...). When the software is stopped (e.g. due to a breakpoint), tigger the command "Debug Window Dump". This will extract the current local variables and ask for a output file name, where the result is stored as unformatted JSON (can be formatted afterwards using the "Format Document" command in VSCode).

Note: If you change the current debug function by clicking on a different function in the stack trace. The dump will target the newly active function and extract the local variables of this scope.

## Features

- Dumps content of the local window into a JSON f
- The max hierarchy of the dumped content is limited to 10

### 0.0.1

- Initial release

### 0.0.2

- Remove the limit of 1000 containers
- Allow setting the recursion depth (hierarchy) via the settings
- Fix debug dump for Python takes very long due to internal methods which are dumped