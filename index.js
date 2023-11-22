const { exec } = require("child_process");
const { existsSync } = require("fs");
const { watch, unlink } = require("fs/promises");
const path = require("path");
const chalk = require("chalk");
const { createInterface } = require("readline");

const messageManager = {
  messages: [],
  push(message, isToClear = false) {
    const m = { message };
    this.messages.push(m);
    this.print();
    const clean = () => {
      const indexToRemove = this.messages.indexOf(m);
      if (indexToRemove === -1) return;
      this.messages.splice(indexToRemove, 1);
      this.print();
    };

    if (isToClear) setTimeout(clean, 5000);
    return clean;
  },
  pushTimed(message) {
    this.push(message, true);
  },
  toString() {
    return this.messages.map(({ message }) => message).join("\n");
  },
  print() {
    console.clear();
    console.log(this.toString());
  },
};

const messages = {
  singleFilePrompt: chalk.blueBright("Enter output pdf name: "),
  singleFileWarning(optionalOutputName) {
    return (
      chalk.yellowBright(`Compressing `) +
      chalk.red("ALL") +
      chalk.yellowBright(" pdfs to ") +
      chalk.greenBright(`${optionalOutputName}.pdf`)
    );
  },
  compressing(fileName) {
    return chalk.yellow(`Compressing ${fileName}`);
  },
  progress(counter) {
    return chalk.green(`(${counter}) Compressed!`);
  },
  watchingFolder(targetPath) {
    return chalk.blueBright(`Watching for new pdfs ${targetPath} ...`);
  },
  unlinkWarning(inputOrOutputFile) {
    return chalk.yellowBright(`Could not unlink ${inputOrOutputFile}`);
  },
  error(error) {
    return chalk.redBright(error);
  },
};

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const target = path.resolve("./");
let counter = 0;
start();

function start() {
  console.clear();
  try {
    readline.question(
      messages.singleFilePrompt,
      watchAndCompressToSinglePDFFile
    );
  } catch (error) {
    messageManager.push(messages.error(error));
    setTimeout(start, 2000);
  }
}
function watchAndCompressToSinglePDFFile(output = "") {
  output = output.replace(/.pdf$/, "").trim();
  if (output.length <= 0) throw new Error("No output provided");
  persistentWatchCompression(output);
}

async function persistentWatchCompression(optionalOutputName) {
  messageManager.push(messages.watchingFolder(target));
  if (optionalOutputName) {
    messageManager.push(messages.singleFileWarning(optionalOutputName));
  }
  messageManager.push("============================\n");

  watchFolder(target, ({ filename: changedFile, eventType }) => {
    {
      const {
        outputPath,
        inputPath,
        outputFile,
        inputIsSameAsOutput,
        isValidPDFFile,
      } = resolveChangedFileData(changedFile, optionalOutputName);

      if (eventType === "rename" && isValidPDFFile && !inputIsSameAsOutput) {
        messageManager.pushTimed(messages.compressing(changedFile));

        ghostScriptCompress(
          changedFile,
          outputFile,
          (error, stdout, stderr) => {
            if (!error && !stderr) {
              messageManager.pushTimed(messages.progress(++counter));
              if (!inputIsSameAsOutput)
                removeFile(changedFile, outputFile, inputPath);
            } else {
              messageManager.pushTimed(
                messages.error(`${error?.message} ${stdout}`)
              );
            }
          }
        );
      }
    }
  });
}

function removeFile(inputFile, outputFile, inputPath) {
  unlink(inputPath).catch(() => {
    messageManager.pushTimed(messages.unlinkWarning(inputFile));
  });
}

function ghostScriptCompress(inputFile, outputFile, onSettled) {
  if (outputFile.length <= 0) throw new Error("No output specified");
  if (inputFile.length <= 0) throw new Error("No input specified");

  return exec(
    `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/prepress -dNOPAUSE -dQUIET -dBATCH -sOutputFile=\"${outputFile}\" \"${inputFile}\"`,
    onSettled
  );
}

function resolveChangedFileData(inputFile = "", optionalOutputName) {
  const outputFile = optionalOutputName
    ? `${optionalOutputName}.pdf`
    : inputFile;
  const inputPath = path.resolve("./", inputFile);
  const outputPath = path.resolve("./", outputFile);
  const inputIsSameAsOutput = inputPath === outputPath;
  const isValidPDFFile =
    inputFile.endsWith(".pdf") &&
    inputFile.replace(/.pdf$/, "").trim().length > 0 &&
    existsSync(inputPath);

  return {
    outputPath,
    inputPath,
    outputFile,
    inputIsSameAsOutput,
    isValidPDFFile,
  };
}

async function watchFolder(folderPath, onChange) {
  for await (const changeData of watch(folderPath)) {
    onChange(changeData);
  }
}
