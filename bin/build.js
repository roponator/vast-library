// BUG : intellisense .toXml() not availables in childs ???

// IDEAS :
// TODO : see if renaming VastElement to VE is worth in term of saved size

// contain 2_0, 3_0, 4_0 or 4_1
const vastVersionSnake = process.argv[2];

if (!vastVersionSnake) {
  throw "this batch needs an arg with the vast version number";
}

// contain 2, 3, 4 or 4.1
const vastVersion = Number(vastVersionSnake.replace("_", "."));
// contain 2, 3, 4 or 4_1
const vastVersionString = String(vastVersion).replace(".", "_");

console.log("=======================");
console.log("=== build version", vastVersion, "===");
console.log("=======================");

const fs = require("fs-extra");

let datas;
try {
  const yaml = require("js-yaml");
  datas = yaml.safeLoad(
    fs.readFileSync(`./specs/vast${vastVersionSnake}.yml`, "utf8")
  );
} catch (error) {
  console.log("=> unable to load specs", error);
  process.exit(1);
}

fs.mkdirsSync("./build/api");
fs.mkdirsSync("./build/doc");

// remove configs from data
const filteredDatas = {
  VAST: datas.VAST
};

const {
  baseContentTemplate,
  classTemplate,
  attachMethodTemplate,
  addMethodTemplate,
  getApiMethodDoc,
  // getJsDoc,
  // getClassDoc,
  extractFirst,
  getArgsTemplate,
  getArgsDocTemplate,
  asyncGetVastElementDoc,
  getApiDocumentationTemplate
} = require("./templates");

const isValidKeyWord = key => {
  return (
    [
      "attrs",
      "only",
      "required",
      "uniq",
      "alo",
      // 'type', // maybe later for type validation
      "follow"
    ].indexOf(key) === -1
  );
};

const allClassList = [];
const apiDocumentation = {
  VastElement: {
    name: "VastElement",
    realName: "VastElement",
    methods: [] // are completed dynamicly in end of this build
  }
};

// adjust to vast api number, just to intellisense beeing clean
let j = Math.floor(vastVersion);

const generateApiAndDoc = (
  isFirst,
  currentName,
  dataObject,
  overrideName = "",
  parentName = ""
) => {
  // prevent to hit reserved word like Error
  const currentUsedName = overrideName ? overrideName : currentName;

  const currentDocName = currentUsedName.split("_")[0];
  const parentDocName = parentName.split("_")[0];

  apiDocumentation[currentUsedName] = {
    name: currentDocName,
    realName: currentUsedName,
    parentName: parentDocName,
    realParentName: parentName,
    extends: "VastElement",
    methods: []
  };

  ["only", "required", "uniq", "alo"].forEach(elem => {
    if (dataObject && dataObject[elem] && dataObject[elem] === true) {
      apiDocumentation[currentUsedName][elem] = true;
    }
  });

  const methodsList = [];
  for (const childName in dataObject) {
    if (!isValidKeyWord(childName)) {
      continue;
    }
    // allow unicity of class names
    let usedChildName = childName + "_" + j++;
    const child = dataObject[childName];

    // manage print content
    const infos = {};
    const hasContent =
      child === null || Object.keys(child).filter(isValidKeyWord).length === 0;
    const hasAttrs = (child && child.attrs && child.attrs.length > 0) || false;
    const isRequired = (child && child.required) || false;
    const hasChild =
      (child && Object.keys(child).filter(isValidKeyWord).length !== 0) ||
      false;
    const currentAttrs = (child && child.attrs) || {};

    if (hasAttrs) {
      infos.attrs = child.attrs.reduce((prev, next) => {
        if (typeof next === "object") {
          prev.push(extractFirst(next).name);
        } else {
          prev.push(next);
        }
        return prev;
      }, []);
    }
    // for API
    const apiArguments = getArgsTemplate(hasContent, hasAttrs, currentAttrs);
    // for documentation
    const docArguments = getArgsDocTemplate(hasContent, hasAttrs, currentAttrs);

    methodsList.push(
      attachMethodTemplate(
        childName,
        "",
        // getJsDoc(
        //   vastVersionString,
        //   usedChildName,
        //   isRequired,
        //   hasContent,
        //   hasAttrs,
        //   currentAttrs
        // ),
        apiArguments,
        usedChildName,
        JSON.stringify(infos)
      )
    );

    if (!hasChild) {
      methodsList.push(
        addMethodTemplate(
          childName,
          "",
          // getJsDoc(
          //   vastVersionString,
          //   currentUsedName,
          //   isRequired,
          //   hasContent,
          //   hasAttrs,
          //   currentAttrs
          // ),
          apiArguments,
          currentUsedName
        )
      );
      apiDocumentation[currentUsedName].methods.push(
        getApiMethodDoc(
          `Add a "${childName}" child to current "${currentDocName}". Return "${currentDocName}" to stay on same current level.`,
          "add" + childName,
          docArguments,
          currentDocName,
          currentUsedName,
          false
        )
      );
    }
    apiDocumentation[currentUsedName].methods.push(
      getApiMethodDoc(
        `Attach a "${childName}" child to current "${currentDocName}". Return "${childName}" to move on child level.`,
        "attach" + childName,
        docArguments,
        childName,
        usedChildName,
        !hasChild
      )
    );
    generateApiAndDoc(
      false,
      childName,
      dataObject[childName],
      usedChildName,
      currentUsedName
    );
  }
  allClassList.push(
    classTemplate(
      currentUsedName,
      parentName || currentName,
      "",
      // getClassDoc(parentName || currentName),
      methodsList.join(""),
      isFirst
    )
  );
};

generateApiAndDoc(true, `apiv${vastVersionString}`, filteredDatas);

const generateValidator = dataObject => {
  const validator = {};

  const validatorType = {
    only: {},
    required: {},
    uniq: {},
    alo: {},
    follow: {},
    attrsRequired: {}
  };
  for (const childName in dataObject) {
    if (!isValidKeyWord(childName)) {
      // managed required attributes
      if (childName === "attrs") {
        for (let i = 0; i < dataObject[childName].length; i++) {
          const attr = dataObject[childName][i];
          if (typeof attr === "object") {
            const object = extractFirst(attr);
            validatorType.attrsRequired[object.name] = object.content;
          }
        }
      }
      continue;
    }
    const childDataObject = dataObject[childName];
    if (childDataObject) {
      ["only", "required", "uniq", "alo"].forEach(elem => {
        if (childDataObject[elem]) {
          validatorType[elem][childName] = generateValidator(childDataObject);
        }
      });
    }
    if (
      !childDataObject ||
      (!childDataObject.only &&
        !childDataObject.required &&
        !childDataObject.uniq &&
        !childDataObject.alo)
    ) {
      validatorType.follow[childName] = generateValidator(childDataObject);
    }
  }
  // add gathered element to validator
  for (const key in validatorType) {
    const element = validatorType[key];
    if (Object.keys(element).length > 0) {
      validator[key] = { ...element };
    }
  }
  return validator;
};

const validator = generateValidator(filteredDatas);

// writing API
fs.writeFileSync(
  `./build/api/vast${vastVersionSnake}.ts`,
  baseContentTemplate(vastVersionString, allClassList.join(""), validator)
);

asyncGetVastElementDoc(methods => {
  apiDocumentation["VastElement"].methods = methods;

  // writing documentation
  fs.writeFileSync(
    `./build/doc/vast${vastVersionSnake}.md`,
    getApiDocumentationTemplate(vastVersionString, apiDocumentation)
  );
  console.log(" => build ok");
});
