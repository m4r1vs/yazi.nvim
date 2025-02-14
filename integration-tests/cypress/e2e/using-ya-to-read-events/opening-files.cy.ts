import type { MyTestDirectoryFile } from "MyTestDirectory"
import {
  isFileNotSelectedInYazi,
  isFileSelectedInYazi,
} from "./utils/yazi-utils"

describe("opening files", () => {
  beforeEach(() => {
    cy.visit("/")
  })

  it("can display yazi in a floating terminal", () => {
    cy.startNeovim().then(() => {
      cy.contains("If you see this text, Neovim is ready!")
      // wait until text on the start screen is visible
      cy.contains("If you see this text, Neovim is ready!")
      cy.typeIntoTerminal("{upArrow}")

      // yazi should now be visible, showing the names of adjacent files
      isFileNotSelectedInYazi("file2.txt" satisfies MyTestDirectoryFile)
    })
  })

  it("can open a file that was selected in yazi", () => {
    cy.startNeovim().then((dir) => {
      cy.contains("If you see this text, Neovim is ready!")
      cy.typeIntoTerminal("{upArrow}")
      cy.contains(dir.contents["file2.txt"].name)

      // search for the file in yazi. This focuses the file in yazi
      cy.typeIntoTerminal(`gg/${dir.contents["file2.txt"].name}{enter}`)
      cy.typeIntoTerminal("{esc}") // hide the search highlight
      isFileSelectedInYazi("file2.txt" satisfies MyTestDirectoryFile)
      cy.typeIntoTerminal("{enter}")

      // the file content should now be visible
      cy.contains("Hello 👋")
    })
  })

  it("can open a file in a vertical split", () => {
    cy.startNeovim().then((dir) => {
      cy.contains("If you see this text, Neovim is ready!")
      cy.typeIntoTerminal("{upArrow}")
      isFileNotSelectedInYazi("file2.txt" satisfies MyTestDirectoryFile)
      cy.typeIntoTerminal(
        `/${"file2.txt" satisfies MyTestDirectoryFile}{enter}`,
      )
      cy.typeIntoTerminal("{esc}") // hide the search highlight
      isFileSelectedInYazi("file2.txt" satisfies MyTestDirectoryFile)
      cy.typeIntoTerminal("{control+v}")

      // yazi should now be closed
      cy.contains("-- TERMINAL --").should("not.exist")

      // the file path must be visible at the bottom
      cy.contains(dir.contents["file2.txt"].name)
      cy.contains(dir.contents["initial-file.txt"].name)
    })
  })

  it("can open a file in a horizontal split", () => {
    cy.startNeovim().then((dir) => {
      cy.contains("If you see this text, Neovim is ready!")
      cy.typeIntoTerminal("{upArrow}")
      cy.contains(dir.contents["file2.txt"].name)
      cy.typeIntoTerminal(`/${dir.contents["file2.txt"].name}{enter}`)
      cy.typeIntoTerminal("{esc}") // hide the search highlight
      isFileSelectedInYazi(dir.contents["file2.txt"].name)
      cy.typeIntoTerminal("{control+x}")

      // yazi should now be closed
      cy.contains("-- TERMINAL --").should("not.exist")

      // the file path must be visible at the bottom
      cy.contains(dir.contents["file2.txt"].name)
      cy.contains(dir.contents["initial-file.txt"].name)
    })
  })

  describe("opening files in new tabs", () => {
    it("can open a file in a new tab", () => {
      cy.startNeovim().then((dir) => {
        cy.contains("If you see this text, Neovim is ready!")
        cy.typeIntoTerminal("{upArrow}")
        isFileNotSelectedInYazi(dir.contents["file2.txt"].name)
        cy.contains(dir.contents["file2.txt"].name)
        cy.typeIntoTerminal(`/${dir.contents["file2.txt"].name}{enter}`)
        cy.typeIntoTerminal("{esc}") // hide the search highlight
        isFileSelectedInYazi(dir.contents["file2.txt"].name)
        cy.typeIntoTerminal("{control+t}")

        // yazi should now be closed
        cy.contains("-- TERMINAL --").should("not.exist")

        cy.contains(
          // match some text from inside the file
          "Hello",
        )
        cy.runExCommand({ command: "tabnext" })

        cy.contains("If you see this text, Neovim is ready!")

        cy.contains(dir.contents["file2.txt"].name)
        cy.contains(dir.contents["initial-file.txt"].name)
      })
    })

    it("preserves line numbers for new tabs", () => {
      // a regression reported in
      // https://github.com/mikavilpas/yazi.nvim/issues/649
      cy.visit("/")
      cy.startNeovim({}).then(() => {
        cy.runExCommand({ command: "set number" })
        cy.runLuaCode({
          luaCode: `assert(vim.o.number == true, "line numbers are not set")`,
        })

        // wait until text on the start screen is visible
        cy.contains("If you see this text, Neovim is ready!")

        // open and close yazi without doing anything. This used to remove line
        // numbering in the new tab, when a previous buffer was switched to
        cy.typeIntoTerminal("{upArrow}")
        cy.contains("config-modifications" satisfies MyTestDirectoryFile)
        cy.typeIntoTerminal("q")
        cy.contains("config-modifications").should("not.exist")

        cy.runExCommand({ command: "tabedit %:p:h/file2.txt" })
        cy.runExCommand({ command: "buffer 1" })

        cy.contains("If you see this text, Neovim is ready!")
        cy.runLuaCode({
          luaCode: `assert(vim.o.number == true, "line numbers are not set")`,
        })
      })
    })
  })

  it("can send file names to the quickfix list", () => {
    cy.startNeovim({ filename: "file2.txt" }).then((dir) => {
      cy.contains("Hello")
      cy.typeIntoTerminal("{upArrow}")

      // wait for yazi to open
      cy.contains(dir.contents["file2.txt"].name)

      // file2.txt should be selected
      isFileSelectedInYazi("file2.txt" satisfies MyTestDirectoryFile)

      // select file2, the cursor moves one line down to the next file
      cy.typeIntoTerminal(" ")
      isFileNotSelectedInYazi("file2.txt" satisfies MyTestDirectoryFile)

      // also select the next file because multiple files have to be selected
      isFileSelectedInYazi("file3.txt" satisfies MyTestDirectoryFile)
      cy.typeIntoTerminal(" ")
      isFileNotSelectedInYazi("file3.txt" satisfies MyTestDirectoryFile)
      cy.typeIntoTerminal("{control+q}")

      // yazi should now be closed
      cy.contains("-- TERMINAL --").should("not.exist")

      // items in the quickfix list should now be visible
      cy.contains(`${dir.contents["file2.txt"].name}||`)
      cy.contains(`${dir.contents["file3.txt"].name}||`)
    })
  })

  describe("bulk renaming", () => {
    it("can bulk rename files", () => {
      cy.startNeovim().then(() => {
        cy.contains("If you see this text, Neovim is ready!")
        // in yazi, bulk renaming is done by
        // - selecting files and pressing "r".
        // - It opens the editor with the names of the selected files.
        // - Next, the editor must make changes to the file names and save the
        //   file.
        // - Finally, yazi should rename the files to match the new names.
        cy.typeIntoTerminal("{upArrow}")

        isFileNotSelectedInYazi("file2.txt" satisfies MyTestDirectoryFile)
        cy.typeIntoTerminal("{control+a}r")

        // yazi should now have opened an embedded Neovim. The file name should say
        // "bulk" somewhere to indicate this
        cy.contains(new RegExp("yazi-\\d+/bulk-\\d+"))

        // edit the name of the first file
        cy.typeIntoTerminal("xxx")
        cy.typeIntoTerminal(":xa{enter}")

        // yazi must now ask for confirmation
        cy.contains("Continue to rename? (y/N):")

        // answer yes
        cy.typeIntoTerminal("y{enter}")
        cy.contains("fig-modifications")
      })
    })

    it("can rename a buffer that's open in Neovim", () => {
      cy.startNeovim().then(() => {
        cy.contains("If you see this text, Neovim is ready!")
        cy.typeIntoTerminal("{upArrow}")
        isFileNotSelectedInYazi("file2.txt" satisfies MyTestDirectoryFile)
        // select only the current file to make the test easier
        cy.typeIntoTerminal("v")
        cy.typeIntoTerminal("r") // start renaming

        // yazi should now have opened an embedded Neovim. The file name should say
        // "bulk" somewhere to indicate this
        cy.contains(new RegExp("yazi-\\d+/bulk-\\d+"))

        // edit the name of the file
        cy.typeIntoTerminal("cc")
        cy.typeIntoTerminal("renamed-file.txt{esc}")
        cy.typeIntoTerminal(":xa{enter}")

        // yazi must now ask for confirmation
        cy.contains("Continue to rename? (y/N):")

        // answer yes
        cy.typeIntoTerminal("y{enter}")

        // close yazi
        cy.typeIntoTerminal("q")

        // the file should now be renamed - ask neovim to confirm this
        cy.runExCommand({ command: "buffers" }).then((result) => {
          expect(result.value).to.contain("renamed-file.txt")
        })
      })
    })
  })

  it("can open files with complex characters in their name", () => {
    cy.startNeovim().then((dir) => {
      cy.contains("If you see this text, Neovim is ready!")
      cy.typeIntoTerminal("{upArrow}")

      // enter the routes/ directory
      cy.contains("routes")
      cy.typeIntoTerminal("/routes{enter}")
      cy.typeIntoTerminal("{rightArrow}")
      cy.contains(
        dir.contents.routes.contents["posts.$postId"].contents["route.tsx"]
          .name,
      ) // file in the directory

      // enter routes/posts.$postId/
      cy.typeIntoTerminal("{rightArrow}")

      // select route.tsx
      cy.typeIntoTerminal(
        `/${dir.contents.routes.contents["posts.$postId"].contents["route.tsx"].name}{enter}`,
      )

      // open the file
      cy.typeIntoTerminal("{enter}")

      // close yazi just to be sure the file preview is not found instead
      cy.get(
        dir.contents.routes.contents["posts.$postId"].contents[
          "adjacent-file.txt"
        ].name,
      ).should("not.exist")

      // the file contents should now be visible
      cy.contains("02c67730-6b74-4b7c-af61-fe5844fdc3d7")
    })
  })

  it("can copy the relative path to the initial file", () => {
    // the copied path should be relative to the file/directory yazi was
    // started in (the initial file)

    cy.startNeovim().then((dir) => {
      cy.contains("If you see this text, Neovim is ready!")

      cy.typeIntoTerminal("{upArrow}")
      isFileNotSelectedInYazi("file2.txt" satisfies MyTestDirectoryFile)

      // enter another directory and select a file
      cy.typeIntoTerminal("/routes{enter}")
      cy.contains("posts.$postId")
      cy.typeIntoTerminal("{rightArrow}")
      cy.contains(
        dir.contents.routes.contents["posts.$postId"].contents["route.tsx"]
          .name,
      ) // file in the directory
      cy.typeIntoTerminal("{rightArrow}")
      cy.typeIntoTerminal(
        `/${
          dir.contents.routes.contents["posts.$postId"].contents[
            "adjacent-file.txt"
          ].name
        }{enter}{esc}`,
        // esc to hide the search highlight
      )
      isFileSelectedInYazi(
        dir.contents.routes.contents["posts.$postId"].contents[
          "adjacent-file.txt"
        ].name,
      )

      // the file contents should now be visible
      cy.contains("this file is adjacent-file.txt")

      cy.typeIntoTerminal("{control+y}")

      // yazi should now be closed
      cy.contains(
        dir.contents.routes.contents["posts.$postId"].contents["route.tsx"]
          .name,
      ).should("not.exist")

      // the relative path should now be in the clipboard. Let's paste it to
      // the file to verify this.
      // NOTE: the test-setup configures the `"` register to be the clipboard
      cy.typeIntoTerminal("o{enter}{esc}")
      cy.runLuaCode({ luaCode: `return vim.fn.getreg('"')` }).then((result) => {
        expect(result.value).to.contain(
          "routes/posts.$postId/adjacent-file.txt" satisfies MyTestDirectoryFile,
        )
      })
    })
  })

  it("can copy the relative paths of multiple selected files", () => {
    // similarly, the copied path should be relative to the file/directory yazi
    // was started in (the initial file)

    cy.startNeovim().then((dir) => {
      cy.contains("If you see this text, Neovim is ready!")

      cy.typeIntoTerminal("{upArrow}")
      cy.contains(dir.contents["file2.txt"].name)

      // enter another directory and select a file
      cy.typeIntoTerminal("/routes{enter}")
      cy.contains("posts.$postId")
      cy.typeIntoTerminal("{rightArrow}")
      cy.contains(
        dir.contents.routes.contents["posts.$postId"].contents["route.tsx"]
          .name,
      ) // file in the directory
      cy.typeIntoTerminal("{rightArrow}")
      cy.typeIntoTerminal("{control+a}")

      cy.typeIntoTerminal("{control+y}")

      // yazi should now be closed
      cy.contains(
        dir.contents.routes.contents["posts.$postId"].contents["route.tsx"]
          .name,
      ).should("not.exist")

      // the relative path should now be in the clipboard. Let's paste it to
      // the file to verify this.
      // NOTE: the test-setup configures the `"` register to be the clipboard
      cy.typeIntoTerminal("o{enter}{esc}")
      cy.runLuaCode({ luaCode: `return vim.fn.getreg('"')` }).then((result) => {
        expect(result.value).to.eql(
          (
            [
              "routes/posts.$postId/adjacent-file.txt",
              "routes/posts.$postId/route.tsx",
              "routes/posts.$postId/should-be-excluded-file.txt",
            ] satisfies MyTestDirectoryFile[]
          ).join("\n"),
        )
      })
    })
  })

  it("can open multiple files in a directory whose name contains a space character", () => {
    cy.startNeovim({ filename: "dir with spaces/file1.txt" }).then((dir) => {
      cy.contains("this is the first file")

      cy.typeIntoTerminal("{upArrow}")
      cy.contains(dir.contents["dir with spaces"].contents["file2.txt"].name)

      // select all files and open them
      cy.typeIntoTerminal("{control+a}")
      cy.typeIntoTerminal("{enter}")

      cy.runExCommand({ command: "buffers" }).then((result) => {
        expect(result.value).to.match(
          new RegExp("dir with spaces/file1.txt" satisfies MyTestDirectoryFile),
        )
        expect(result.value).to.match(
          new RegExp("dir with spaces/file2.txt" satisfies MyTestDirectoryFile),
        )
      })
    })
  })

  it("can open multiple open files in yazi tabs", () => {
    cy.startNeovim({
      filename: {
        openInVerticalSplits: [
          "initial-file.txt",
          "file2.txt",
          "dir with spaces/file1.txt",
        ],
      },
      startupScriptModifications: [
        "modify_yazi_config_and_open_multiple_files.lua",
      ],
    }).then((dir) => {
      cy.contains("Hello")

      // now that multiple files are open, and the configuration has been set
      // to open multiple files in yazi tabs, opening yazi should show the
      // tabs
      cy.typeIntoTerminal("{upArrow}")

      // this is the first yazi tab (1)
      isFileSelectedInYazi(dir.contents["initial-file.txt"].name)
      isFileNotSelectedInYazi(dir.contents["file2.txt"].name)

      // next, move to the second tab (2)
      cy.typeIntoTerminal("2")
      isFileSelectedInYazi(dir.contents["file2.txt"].name)
      isFileNotSelectedInYazi(dir.contents["initial-file.txt"].name)

      // next, move to the third tab (3). This tab should be in a different
      // directory, so other adjacent files should be visible than before
      cy.typeIntoTerminal("3")
      cy.contains(dir.contents["dir with spaces"].contents["file1.txt"].name)
      isFileSelectedInYazi(
        dir.contents["dir with spaces"].contents["file1.txt"].name,
      )
      isFileNotSelectedInYazi(
        dir.contents["dir with spaces"].contents["file2.txt"].name,
      )
    })
  })
})
