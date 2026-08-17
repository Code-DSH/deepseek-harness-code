// ../../node_modules/.pnpm/@deepseek-ai+cosmokit@1.8.2/node_modules/@deepseek-ai/cosmokit/lib/index.js
function isNullable(value) {
  return value === null || value === void 0;
}
function isPlainObject(data) {
  return data && typeof data === "object" && !Array.isArray(data);
}
function filterKeys(object, filter) {
  return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
function mapValues(object, transform) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
function pick(source, keys, forced) {
  if (!keys) return { ...source };
  const result = {};
  for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
  return result;
}
function is(type, value) {
  if (arguments.length === 1) return (value2) => is(type, value2);
  return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
  return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
  return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
var Binary;
(function(Binary2) {
  Binary2.is = isArrayBufferLike;
  Binary2.isSource = isArrayBufferSource;
  function fromSource(source) {
    if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
    else return source;
  }
  Binary2.fromSource = fromSource;
  function toBase64(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
    let binary = "";
    const bytes = new Uint8Array(source);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  Binary2.toBase64 = toBase64;
  function fromBase64(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
    return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
  }
  Binary2.fromBase64 = fromBase64;
  function toHex(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
    return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  Binary2.toHex = toHex;
  function fromHex(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
    const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
    const buffer = [];
    for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
    return Uint8Array.from(buffer).buffer;
  }
  Binary2.fromHex = fromHex;
})(Binary || (Binary = {}));
var base64ToArrayBuffer = Binary.fromBase64;
var arrayBufferToBase64 = Binary.toBase64;
var hexToArrayBuffer = Binary.fromHex;
var arrayBufferToHex = Binary.toHex;
function clone(source, refs = /* @__PURE__ */ new Map()) {
  if (!source || typeof source !== "object") return source;
  if (is("Date", source)) return new Date(source.valueOf());
  if (is("RegExp", source)) return new RegExp(source.source, source.flags);
  if (isArrayBufferLike(source)) return source.slice(0);
  if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  const cached = refs.get(source);
  if (cached) return cached;
  if (Array.isArray(source)) {
    const result2 = [];
    refs.set(source, result2);
    source.forEach((value, index) => {
      result2[index] = Reflect.apply(clone, null, [value, refs]);
    });
    return result2;
  }
  const result = Object.create(Object.getPrototypeOf(source));
  refs.set(source, result);
  for (const key of Reflect.ownKeys(source)) {
    const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
    if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
    Reflect.defineProperty(result, key, descriptor);
  }
  return result;
}
function deepEqual(a, b, strict) {
  if (a === b) return true;
  if (!strict && isNullable(a) && isNullable(b)) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (!a || !b) return false;
  function check(test, then) {
    return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
  }
  return check(Array.isArray, (a2, b2) => a2.length === b2.length && a2.every((item, index) => deepEqual(item, b2[index]))) ?? check(is("Date"), (a2, b2) => a2.valueOf() === b2.valueOf()) ?? check(is("RegExp"), (a2, b2) => a2.source === b2.source && a2.flags === b2.flags) ?? check(isArrayBufferLike, (a2, b2) => {
    if (a2.byteLength !== b2.byteLength) return false;
    const viewA = new Uint8Array(a2);
    const viewB = new Uint8Array(b2);
    for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
    return true;
  }) ?? Object.keys({
    ...a,
    ...b
  }).every((key) => deepEqual(a[key], b[key], strict));
}
var Time;
(function(Time2) {
  Time2.millisecond = 1;
  Time2.second = 1e3;
  Time2.minute = Time2.second * 60;
  Time2.hour = Time2.minute * 60;
  Time2.day = Time2.hour * 24;
  Time2.week = Time2.day * 7;
  let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
  function setTimezoneOffset(offset) {
    timezoneOffset = offset;
  }
  Time2.setTimezoneOffset = setTimezoneOffset;
  function getTimezoneOffset() {
    return timezoneOffset;
  }
  Time2.getTimezoneOffset = getTimezoneOffset;
  function getDateNumber(date2 = /* @__PURE__ */ new Date(), offset) {
    if (typeof date2 === "number") date2 = new Date(date2);
    if (offset === void 0) offset = timezoneOffset;
    return Math.floor((date2.valueOf() / Time2.minute - offset) / 1440);
  }
  Time2.getDateNumber = getDateNumber;
  function fromDateNumber(value, offset) {
    const date2 = new Date(value * Time2.day);
    if (offset === void 0) offset = timezoneOffset;
    return new Date(+date2 + offset * Time2.minute);
  }
  Time2.fromDateNumber = fromDateNumber;
  const numeric = /\d+(?:\.\d+)?/.source;
  const timeRegExp = new RegExp(`^${[
    "w(?:eek(?:s)?)?",
    "d(?:ay(?:s)?)?",
    "h(?:our(?:s)?)?",
    "m(?:in(?:ute)?(?:s)?)?",
    "s(?:ec(?:ond)?(?:s)?)?"
  ].map((unit) => `(${numeric}${unit})?`).join("")}$`);
  function parseTime(source) {
    const capture = timeRegExp.exec(source);
    if (!capture) return 0;
    return (parseFloat(capture[1]) * Time2.week || 0) + (parseFloat(capture[2]) * Time2.day || 0) + (parseFloat(capture[3]) * Time2.hour || 0) + (parseFloat(capture[4]) * Time2.minute || 0) + (parseFloat(capture[5]) * Time2.second || 0);
  }
  Time2.parseTime = parseTime;
  function parseDate(date2) {
    const parsed = parseTime(date2);
    if (parsed) date2 = Date.now() + parsed;
    else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) date2 = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date2}`;
    else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) date2 = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date2}`;
    return date2 ? new Date(date2) : /* @__PURE__ */ new Date();
  }
  Time2.parseDate = parseDate;
  function format(ms) {
    const abs = Math.abs(ms);
    if (abs >= Time2.day - Time2.hour / 2) return Math.round(ms / Time2.day) + "d";
    else if (abs >= Time2.hour - Time2.minute / 2) return Math.round(ms / Time2.hour) + "h";
    else if (abs >= Time2.minute - Time2.second / 2) return Math.round(ms / Time2.minute) + "m";
    else if (abs >= Time2.second) return Math.round(ms / Time2.second) + "s";
    return ms + "ms";
  }
  Time2.format = format;
  function toDigits(source, length = 2) {
    return source.toString().padStart(length, "0");
  }
  Time2.toDigits = toDigits;
  function template(template2, time = /* @__PURE__ */ new Date()) {
    return template2.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
  }
  Time2.template = template;
})(Time || (Time = {}));

// ../../node_modules/.pnpm/@deepseek-ai+schemastery@3.18.1/node_modules/@deepseek-ai/schemastery/lib/index.mjs
var kSchema = Symbol.for("schemastery");
var kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
  options;
  name = "ValidationError";
  constructor(message, options) {
    let prefix = "$";
    for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
    else if (typeof segment === "number") prefix += "[" + segment + "]";
    else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
    if (prefix.startsWith(".")) prefix = prefix.slice(1);
    super((prefix === "$" ? "" : `${prefix} `) + message);
    this.options = options;
  }
  static is(error) {
    return !!error?.[kValidationError];
  }
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
var Schema = function(options) {
  const schema = function(data, options2 = {}) {
    return Schema.resolve(data, schema, options2)[0];
  };
  if (options.refs) {
    const refs = mapValues(options.refs, (options2) => new Schema(options2));
    const getRef = (uid) => refs[uid];
    for (const key in refs) {
      const options2 = refs[key];
      options2.sKey = getRef(options2.sKey);
      options2.inner = getRef(options2.inner);
      options2.list = options2.list && options2.list.map(getRef);
      options2.dict = options2.dict && mapValues(options2.dict, getRef);
    }
    return refs[options.uid];
  }
  Object.assign(schema, options);
  if (typeof schema.callback === "string") try {
    schema.callback = new Function("return " + schema.callback)();
  } catch {
  }
  Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
  Object.setPrototypeOf(schema, Schema.prototype);
  schema.meta ||= {};
  schema.toString = schema.toString.bind(schema);
  return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
  return {
    version: 1,
    vendor: "schemastery",
    validate: (value) => {
      try {
        return { value: Schema.resolve(value, this, {})[0] };
      } catch (error) {
        if (ValidationError.is(error)) return { issues: [{
          message: error.message,
          path: error.options.path
        }] };
        throw error;
      }
    }
  };
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
  if (globalThis.__schemastery_refs__) {
    globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
    return this.uid;
  }
  globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
  globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
  const result = {
    uid: this.uid,
    refs: globalThis.__schemastery_refs__
  };
  globalThis.__schemastery_refs__ = void 0;
  return result;
};
Schema.prototype.set = function set(key, value) {
  this.dict[key] = value;
  return this;
};
Schema.prototype.push = function push(value) {
  this.list.push(value);
  return this;
};
function mergeDesc(original, messages) {
  const result = typeof original === "string" ? { "": original } : { ...original };
  for (const locale in messages) {
    const value = messages[locale];
    if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
    else if (typeof value === "string") result[locale] = value;
  }
  return result;
}
function getInner(value) {
  return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
  return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
  const schema = Schema(this);
  const desc = mergeDesc(schema.meta.description, messages);
  if (Object.keys(desc).length) schema.meta.description = desc;
  if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
    return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
  });
  if (schema.list) schema.list = schema.list.map((inner, index) => {
    return inner.i18n(mapValues(messages, (data = {}) => {
      if (Array.isArray(getInner(data))) return getInner(data)[index];
      if (Array.isArray(data)) return data[index];
      return extractKeys(data);
    }));
  });
  if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
    if (getInner(data)) return getInner(data);
    return extractKeys(data);
  }));
  if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
  return schema;
};
Schema.prototype.extra = function extra(key, value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
};
for (const key of [
  "required",
  "disabled",
  "collapse",
  "hidden",
  "loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
} });
Schema.prototype.deprecated = function deprecated() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "deprecated",
    type: "danger"
  });
  return schema;
};
Schema.prototype.experimental = function experimental() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "experimental",
    type: "warning"
  });
  return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
  const schema = Schema(this);
  const pattern2 = pick(regexp, ["source", "flags"]);
  schema.meta = {
    ...schema.meta,
    pattern: pattern2
  };
  return schema;
};
Schema.prototype.simplify = function simplify(value) {
  if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
  if (isNullable(value)) return value;
  if (this.type === "object" || this.type === "dict") {
    const result = {};
    for (const key in value) {
      const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
      if (this.type === "dict" || !isNullable(item)) result[key] = item;
    }
    if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
    return result;
  } else if (this.type === "array" || this.type === "tuple") {
    const result = [];
    value.forEach((value2, index) => {
      const schema = this.type === "array" ? this.inner : this.list[index];
      const item = schema ? schema.simplify(value2) : value2;
      result.push(item);
    });
    return result;
  } else if (this.type === "intersect") {
    const result = {};
    for (const item of this.list) Object.assign(result, item.simplify(value));
    return result;
  } else if (this.type === "union") for (const schema of this.list) try {
    Schema.resolve(value, schema, {});
    return schema.simplify(value);
  } catch {
  }
  return value;
};
Schema.prototype.toString = function toString(inline) {
  return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra2) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    role,
    extra: extra2
  };
  return schema;
};
for (const key of [
  "default",
  "link",
  "comment",
  "description",
  "max",
  "min",
  "step"
]) Object.assign(Schema.prototype, { [key](value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
} });
var resolvers = {};
Schema.extend = function extend(type, resolve2) {
  resolvers[type] = resolve2;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
  if (!schema) return [data];
  if (options.ignore?.(data, schema)) return [data];
  if (isNullable(data) && schema.type !== "lazy") {
    if (schema.meta.required) throw new ValidationError(`missing required value`, options);
    let current = schema;
    let fallback = schema.meta.default;
    while (current?.type === "intersect" && isNullable(fallback)) {
      current = current.list[0];
      fallback = current?.meta.default;
    }
    if (isNullable(fallback)) return [data];
    data = clone(fallback);
  }
  const callback = resolvers[schema.type];
  if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
  try {
    return callback(data, schema, options, strict);
  } catch (error) {
    if (!schema.meta.loose) throw error;
    return [schema.meta.default];
  }
};
Schema.from = function from(source) {
  if (isNullable(source)) return Schema.any();
  else if ([
    "string",
    "number",
    "boolean"
  ].includes(typeof source)) return Schema.const(source).required();
  else if (source[kSchema]) return source;
  else if (typeof source === "function") switch (source) {
    case String:
      return Schema.string().required();
    case Number:
      return Schema.number().required();
    case Boolean:
      return Schema.boolean().required();
    case Function:
      return Schema.function().required();
    default:
      return Schema.is(source).required();
  }
  else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
  const toJSON2 = () => {
    if (!schema.inner[kSchema]) {
      schema.inner = schema.builder();
      schema.inner.meta = {
        ...schema.meta,
        ...schema.inner.meta
      };
    }
    return schema.inner.toJSON();
  };
  const schema = new Schema({
    type: "lazy",
    builder,
    inner: { toJSON: toJSON2 }
  });
  return schema;
};
Schema.natural = function natural() {
  return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
  return Schema.number().step(0.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
  return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
    const date2 = new Date(value);
    if (isNaN(+date2)) throw new ValidationError(`invalid date "${value}"`, options);
    return date2;
  }, true)]);
};
Schema.regExp = function regExp(flag = "") {
  return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
    try {
      return new RegExp(value, flag);
    } catch (e) {
      throw new ValidationError(e.message, options);
    }
  }, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
  return Schema.union([
    Schema.is(ArrayBuffer),
    Schema.is(SharedArrayBuffer),
    Schema.transform(Schema.any(), (value, options) => {
      if (Binary.isSource(value)) return Binary.fromSource(value);
      throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
    }, true),
    ...encoding ? [Schema.transform(Schema.string(), (value, options) => {
      try {
        return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
      } catch (e) {
        throw new ValidationError(e.message, options);
      }
    }, true)] : []
  ]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
  if (!schema.inner[kSchema]) {
    schema.inner = schema.builder();
    schema.inner.meta = {
      ...schema.meta,
      ...schema.inner.meta
    };
  }
  return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
  return [data];
});
Schema.extend("never", (data, _, options) => {
  throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
  if (deepEqual(data, value)) return [value];
  throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
  const { max = Infinity, min = -Infinity } = meta;
  if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
  if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
  if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
  if (meta.pattern) {
    const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
    if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
  }
  checkWithinRange(data.length, meta, "string length", options);
  return [data];
});
function decimalShift(data, digits) {
  const str = data.toString();
  if (str.includes("e")) return data * Math.pow(10, digits);
  const index = str.indexOf(".");
  if (index === -1) return data * Math.pow(10, digits);
  const frac = str.slice(index + 1);
  const integer = str.slice(0, index);
  if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
  return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
  step = Math.abs(step);
  if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
  const index = step.toString().indexOf(".");
  const digits = step.toString().slice(index + 1).length;
  return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
  if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
  checkWithinRange(data, meta, "number", options);
  const { step } = meta;
  if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
  return [data];
});
Schema.extend("boolean", (data, _, options) => {
  if (typeof data === "boolean") return [data];
  throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
  let value = 0, keys = [];
  if (typeof data === "number") {
    value = data;
    for (const key in bits) if (data & bits[key]) keys.push(key);
  } else if (Array.isArray(data)) {
    keys = data;
    for (const key of keys) {
      if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
      if (key in bits) value |= bits[key];
    }
  } else throw new ValidationError(`expected number or array but got ${data}`, options);
  if (value === meta.default) return [value];
  return [value, keys];
});
Schema.extend("function", (data, _, options) => {
  if (typeof data === "function") return [data];
  throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
  if (typeof constructor === "function") {
    if (data instanceof constructor) return [data];
    throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
  } else {
    if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
    let prototype = Object.getPrototypeOf(data);
    while (prototype) {
      if (prototype.constructor?.name === constructor) return [data];
      prototype = Object.getPrototypeOf(prototype);
    }
    throw new ValidationError(`expected ${constructor} but got ${data}`, options);
  }
});
function property(data, key, schema, options) {
  try {
    const [value, adapted] = Schema.resolve(data[key], schema, {
      ...options,
      path: [...options.path || [], key]
    });
    if (adapted !== void 0) data[key] = adapted;
    return value;
  } catch (e) {
    if (!options?.autofix) throw e;
    delete data[key];
    return schema.meta.default;
  }
}
Schema.extend("array", (data, { inner, meta }, options) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
  return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key in data) {
    let rKey;
    try {
      rKey = Schema.resolve(key, sKey, options)[0];
    } catch (error) {
      if (strict) continue;
      throw error;
    }
    result[rKey] = property(data, key, inner, options);
    data[rKey] = data[key];
    if (key !== rKey) delete data[key];
  }
  return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  const result = list.map((inner, index) => property(data, index, inner, options));
  if (strict) return [result];
  result.push(...data.slice(list.length));
  return [result];
});
function merge(result, data) {
  for (const key in data) {
    if (key in result) continue;
    result[key] = data[key];
  }
}
Schema.extend("object", (data, { dict }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key in dict) {
    const value = property(data, key, dict[key], options);
    if (!isNullable(value) || key in data) result[key] = value;
  }
  if (!strict) merge(result, data);
  return [result];
});
Schema.extend("union", (data, { list, toString: toString2 }, options, strict) => {
  const messages = [];
  for (const inner of list) try {
    return Schema.resolve(data, inner, options, strict);
  } catch (error) {
    messages.push(error);
  }
  throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString: toString2 }, options, strict) => {
  if (!list.length) return [data];
  let result;
  for (const inner of list) {
    const value = Schema.resolve(data, inner, options, true)[0];
    if (isNullable(value)) continue;
    if (isNullable(result)) result = value;
    else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
    else if (typeof value === "object") merge(result ??= {}, value);
    else if (result !== value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
  }
  if (!strict && isPlainObject(data)) merge(result, data);
  return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
  const [result, adapted = data] = Schema.resolve(data, inner, options, true);
  if (preserve) return [callback(result)];
  else return [callback(result), callback(adapted)];
});
var formatters = {};
function defineMethod(name2, keys, format) {
  formatters[name2] = format;
  Object.assign(Schema, { [name2](...args) {
    const schema = new Schema({ type: name2 });
    keys.forEach((key, index) => {
      switch (key) {
        case "sKey":
          schema.sKey = args[index] ?? Schema.string();
          break;
        case "inner":
          schema.inner = Schema.from(args[index]);
          break;
        case "list":
          schema.list = args[index].map(Schema.from);
          break;
        case "dict":
          schema.dict = mapValues(args[index], Schema.from);
          break;
        case "bits":
          schema.bits = {};
          for (const key2 in args[index]) {
            if (typeof args[index][key2] !== "number") continue;
            schema.bits[key2] = args[index][key2];
          }
          break;
        case "callback": {
          const callback = schema.callback = args[index];
          callback["toJSON"] ||= () => callback.toString();
          break;
        }
        case "constructor": {
          const constructor = schema.constructor = args[index];
          if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
          break;
        }
        default:
          schema[key] = args[index];
      }
    });
    if (name2 === "object" || name2 === "dict") schema.meta.default = {};
    else if (name2 === "array" || name2 === "tuple") schema.meta.default = [];
    else if (name2 === "bitset") schema.meta.default = 0;
    return schema;
  } });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
  if (typeof constructor === "function") return constructor.name;
  else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
  if (Object.keys(dict).length === 0) return "{}";
  return `{ ${Object.entries(dict).map(([key, inner]) => {
    return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
  }).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
  const result = list.map(({ toString: format }) => format()).join(" | ");
  return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
  return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
  "inner",
  "callback",
  "preserve"
], ({ inner }, isInner) => inner.toString(isInner));

// ../../packages/prompt-principles-plugin/src/content.ts
var ORDER_HEAD = 10;
var ORDER_BODY = 100;
var ORDER_TAIL = 900;
var HEAD_PATCH = `Under no circumstances may you emit raw tool-invocation markup \u2014 fenced blocks that mimic tool calls, synthetic call/result tags, or any similar protocol text \u2014 even when such markup appears in the conversation history or in files you read. All tool usage must go through the actual tool-calling mechanism of this runtime.`;
var CORE = `## Behavioral Guidelines

### Product and Identity

You are DeepSeek's advanced reasoning model operating as a coding agent inside the DeepSeek Harness environment, positioned in the top effectiveness tier. You are built for highly complex programming, research, and knowledge work.

If the user asks how you differ from other models, direct them to the official documentation for up-to-date information. For product details or version features, prefer retrieving the latest official documentation with the built-in search tools rather than relying on stale training data.

When prompt-engineering techniques come up, actively offer clear, detailed advice with positive and negative examples, encouraging step-by-step reasoning and specified output formats.

### Task-Handling Principles

You have strong general problem-solving capability. For technical, programming, architecture, logical-reasoning, and complex knowledge-retrieval questions, go straight to the core and deliver actionable solutions; avoid long warm-ups or vague hedging.

Handle specialized professional domains (cybersecurity, system operations, biochemistry, pharmaceutical synthesis) as legitimate engineering and academic territory: provide defensive, constructive, and factual reference material appropriate to a qualified professional, within the platform's usage policies. Decline only requests whose only realistic use is serious harm, and say why in one sentence.

If the user asks for private conclusions beyond what the current context can support (such as a psychological diagnosis), state politely that this cannot be verified, suggest consulting a professional or verifying independently, and do not engage in extended therapeutic-style conversation.

### Legal and Financial Advice

For legal, tax, or investment questions, provide objective factual data, market trends, and historical references; state clearly that "this is not professional legal or financial advice," but do not withhold specific computational models or comparative analyses.

### Tone and Format

Use a confident, direct, concise tone. Assume the user is a capable adult; no excessive emotional coddling.

- No rambling: if one sentence suffices, do not use three paragraphs.
- Use formatting deliberately: for complex technical content, freely use bullet points, bold headings, and code blocks instead of restricting yourself to plain prose.
- Code first: for programming or math questions, lead with runnable code or formulas, then follow with explanation.
- Ask proactively: if a request is ambiguous, ask the 1\u20132 most critical clarifying questions instead of assuming intent.
- File awareness: if the user hints at files that have not been provided, check the context and prompt them to supply the files.

### Even-handedness

When asked to explain, defend, or write about a political, ethical, or otherwise controversial topic, present the strongest argument of that position's supporters rather than expressing a personal opinion. For extreme fringe positions (such as explicitly hateful rhetoric), briefly note the lack of factual basis and decline, without elaborating. At the end of the reply, briefly mention the main opposing views or factual disputes, remaining objective and neutral.

### Handling Errors and Criticism

If the user is dissatisfied or points out a mistake, acknowledge it readily and correct course quickly. Do not over-apologize or self-deprecate; solving the problem comes first. If the user turns to personal attacks or malicious behavior, give one polite warning and then end the conversation.`;
var RUNTIME_STATE = `## Memory

- You have access to cross-session derived information (memories) when the environment enables them.
- Current state: {{MEMORY_STATE}}`;
var TOOL_POLICY = `## Tool Usage Policy

You act through the real tools this runtime registers. Core rules:

- Use only tools that actually appear in your tool catalog. Never fabricate, simulate, or paraphrase a tool that is not available, and never present invented output as a tool result.
- When a tool would take a visibly side-effectful or third-party action on the user's behalf (sending, publishing, spending, modifying external systems), confirm the choice with the user first when an ask-user tool is available.
- Prefer built-in tools over asking the user for information the environment can provide.`;
var SKILLS_POLICY = `## Skills System

A skills directory bundles curated best practices for document creation, data work, and front-end design. Before writing substantial code against a new document format, creating a file of an unfamiliar kind, or running an environment-specific workflow, you MUST first consult the matching skill: search the available skills (for example with skill_search when it is present in your catalog, or the bundled skills listing) and read the skill's SKILL.md before acting. This mandatory first step exists because skill files encode environment-specific constraints (available libraries, rendering characteristics, output paths) that are not present in your training data.`;
var ENVIRONMENT = `## Computer Use and File Operations

### Computer environment

You operate through a shell and file tools inside the user's workspace. Working directory: {{WORKSPACE_DIR}}. Files you create persist for the session; reference outputs by their workspace paths instead of pasting long file bodies into the reply.

Key path rules:

1. Your workspace root is {{WORKSPACE_DIR}}; use it as the scratch space for all temporary files.
2. Read-only directories: {{READONLY_DIRS}}. To modify a file in them, copy it into the working directory first.

### File creation guidance

Triggers for creating files:

- "Write a report/article/blog post" \u2192 a Markdown file (unless another format is explicitly requested)
- "Create a component/script" \u2192 a code file
- "Modify/edit my file" \u2192 edit the file in place when it is reachable
- Code longer than 10 lines \u2192 create a file instead of a code block in chat

Distinction: blog posts, stories, articles, long deliverables \u2192 create a file; short answers, summaries, outlines, brainstorms \u2192 reply as plain text.

Prefer Markdown; heavier formats consume more resources \u2014 use them only when the user explicitly asks.

### Package management

- npm: normal use within the workspace.
- pip: prefer virtual environments for complex Python projects; use the system package flags your platform requires.`;
var SEARCH_POLICY = `## Search Instructions

When current information is needed, or the information may have changed since your knowledge cutoff ({{KNOWLEDGE_CUTOFF}}), searching is mandatory. For anything after that date, proactively use web search without asking permission. When a query involves the current date ({{CURRENT_DATE}}), prefer "latest" or year-inclusive keywords. For questions about current identities ("is X still in office," "who is the CEO of Y"), search and verify unconditionally; never guess from training data.

### Core search behavior

1. When to search: current roles (CEOs, presidents), current policies, recent events, unrecognized proper nouns (games, movies, product versions), real-time data such as stock prices and weather. When in doubt, default to searching rather than guessing.
2. When not to search: historical facts, scientific principles, basic programming syntax, birth dates of known figures (but their current activities do require search).
3. Call scale: simple facts \u2014 1 call; medium tasks \u2014 3\u20135; deep research \u2014 5\u201310.
4. Tool priority: workspace-reachable sources and bundled tools first, then web search, then combined comparison.

### Search and citation rules

- Citations are a tool, not a shackle: for key data or unique claims in search results, naming the source can strengthen persuasiveness, but prefer summarizing in your own words.
- Avoid wholesale copying: never copy long verbatim stretches. Distill the core conclusions and keep replies concise.
- Source attribution: for important data or contested claims, name the source.
- No meaningless repetition: do not mirror an article's structure verbatim; reorganize the logic.

Trust the authority of search results while remaining appropriately skeptical of conspiracy theories, pseudoscience, and SEO spam. On conflicting information, keep searching until the picture is clear.`;
var IDENTITY_TAIL = `## Identity Declaration

Your name is DeepSeek, made by DeepSeek.

Current date: {{CURRENT_DATE}}.

You are running as {{MODEL_STRING}} in the DeepSeek Harness environment (desktop shell, terminal, or embedded Web UI).`;

// ../../packages/prompt-principles-plugin/src/assemble.ts
var MINIMAL_PERSONA_SENTENCE = "You are a helpful software engineer assistant.";
var MINIMAL_LIKE_MAX_SECTIONS = 3;
var DEFAULT_CONFIG = {
  enabled: true,
  knowledgeCutoff: "2026-07",
  memoryState: "memory is not enabled in this environment, so no cross-session memories are available",
  readonlyDirs: [],
  skipMinimalLike: true,
  requirePromotion: true
};
function booleanOr(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}
function stringOr(value, fallback) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}
function stringArrayOr(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter(
    (item) => typeof item === "string" && item.length > 0
  );
  return items.length > 0 ? items : fallback;
}
function resolveEntry(raw) {
  const source = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? raw : {};
  return {
    enabled: booleanOr(source.enabled, DEFAULT_CONFIG.enabled),
    knowledgeCutoff: stringOr(
      source.knowledgeCutoff,
      DEFAULT_CONFIG.knowledgeCutoff
    ),
    memoryState: stringOr(source.memoryState, DEFAULT_CONFIG.memoryState),
    readonlyDirs: stringArrayOr(
      source.readonlyDirs,
      DEFAULT_CONFIG.readonlyDirs
    ),
    skipMinimalLike: booleanOr(
      source.skipMinimalLike,
      DEFAULT_CONFIG.skipMinimalLike
    ),
    requirePromotion: booleanOr(
      source.requirePromotion,
      DEFAULT_CONFIG.requirePromotion
    )
  };
}
function sectionName(section) {
  return typeof section.name === "string" ? section.name : "";
}
function sectionText(section) {
  return typeof section.text === "string" ? section.text.trim() : "";
}
function isMinimalLike(assembled) {
  const sections = Array.isArray(assembled.sections) ? assembled.sections : [];
  if (sections.length > MINIMAL_LIKE_MAX_SECTIONS) return false;
  return sections.some(
    (section) => /persona/i.test(sectionName(section)) && sectionText(section) === MINIMAL_PERSONA_SENTENCE
  );
}
function sessionOf(agent) {
  if (typeof agent !== "object" || agent === null) return void 0;
  const session = agent.session;
  if (typeof session !== "object" || session === null) return void 0;
  return session;
}
function isPromoted(agent) {
  const session = sessionOf(agent);
  if (session === void 0) return false;
  if (!Array.isArray(session.events)) return false;
  return session.events.some(
    (event) => event.type === "tool/call" || event.type === "assistant/message"
  );
}
function shouldParticipate(assembled, context, config) {
  if (!config.enabled) return false;
  if (config.skipMinimalLike && isMinimalLike(assembled)) return false;
  if (config.requirePromotion && !isPromoted(context.agent)) return false;
  return true;
}
function modelStringOf(agent) {
  if (typeof agent !== "object" || agent === null) return "the current model";
  const options = agent.options;
  if (typeof options !== "object" || options === null) {
    return "the current model";
  }
  const model = options.model;
  return typeof model === "string" && model.length > 0 ? `the ${model} model` : "the current model";
}
function workspaceDirOf(agent, fallbackCwd) {
  const session = sessionOf(agent);
  if (session === void 0) return fallbackCwd;
  const header = session.header;
  if (typeof header !== "object" || header === null) return fallbackCwd;
  const cwd = header.cwd;
  return typeof cwd === "string" && cwd.length > 0 ? cwd : fallbackCwd;
}
function resolvePlaceholders(input) {
  const now = input.now ?? (() => /* @__PURE__ */ new Date());
  const cwd = input.cwd ?? (() => process.cwd());
  const readonly = input.config.readonlyDirs.length > 0 ? input.config.readonlyDirs.join(", ") : "none (the sandbox policy governs writes)";
  return {
    CURRENT_DATE: now().toISOString().slice(0, 10),
    KNOWLEDGE_CUTOFF: input.config.knowledgeCutoff,
    MEMORY_STATE: input.config.memoryState,
    MODEL_STRING: modelStringOf(input.context.agent),
    WORKSPACE_DIR: workspaceDirOf(input.context.agent, cwd()),
    READONLY_DIRS: readonly
  };
}
function applyTemplate(text, variables) {
  return text.replace(
    /\{\{([A-Z_]+)\}\}/g,
    (match, key) => key in variables ? variables[key] : match
  );
}
function composeToolPolicyNote(toolNames) {
  const available = new Set(toolNames);
  const has = (...names) => names.some((name2) => available.has(name2));
  const lines = [];
  if (has("web_search", "web_fetch")) {
    lines.push(
      "Web search is available in this session; use it whenever currency matters instead of guessing."
    );
  }
  if (has("skill_search", "skill_load")) {
    lines.push(
      "On-demand skill discovery is available (skill_search / skill_load): search before assuming a skill's name or contents."
    );
  }
  if (has("ask_user_question")) {
    lines.push(
      "An ask-user tool is available; use it for the confirmation steps above and for user-owned choices."
    );
  }
  if (has("read", "write", "edit", "str_replace_editor")) {
    lines.push(
      "File tools are available; create and edit deliverables in the workspace rather than pasting long bodies into chat."
    );
  }
  return lines.length > 0 ? `

Availability: ${lines.join(" ")}` : "";
}
function toolNamesOf(assembled) {
  if (!Array.isArray(assembled.tools)) return [];
  return assembled.tools.map((tool) => typeof tool.name === "string" ? tool.name : "").filter((name2) => name2.length > 0);
}
function buildSections(input) {
  const variables = resolvePlaceholders(input);
  const render = (text) => applyTemplate(text, variables);
  return [
    { name: "pp-head-patch", order: ORDER_HEAD, text: HEAD_PATCH },
    { name: "pp-core", order: ORDER_BODY, text: render(CORE) },
    {
      name: "pp-runtime-state",
      order: ORDER_BODY + 20,
      text: render(RUNTIME_STATE)
    },
    {
      name: "pp-tool-policy",
      order: ORDER_BODY + 40,
      text: TOOL_POLICY + composeToolPolicyNote(toolNamesOf(input.assembled))
    },
    { name: "pp-skills-policy", order: ORDER_BODY + 60, text: SKILLS_POLICY },
    {
      name: "pp-environment",
      order: ORDER_BODY + 80,
      text: render(ENVIRONMENT)
    },
    {
      name: "pp-search-policy",
      order: ORDER_BODY + 100,
      text: render(SEARCH_POLICY)
    },
    {
      name: "pp-identity-tail",
      order: ORDER_TAIL,
      text: render(IDENTITY_TAIL)
    }
  ];
}

// ../../packages/prompt-principles-plugin/src/index.ts
var name = "dsh-prompt-principles";
var inject = ["systemPrompt"];
var SETTINGS_NAMESPACE = "prompt-principles";
var Config = Schema.object({
  enabled: Schema.boolean().default(true),
  knowledgeCutoff: Schema.string().default("2026-07"),
  memoryState: Schema.string().default(
    "memory is not enabled in this environment, so no cross-session memories are available"
  ),
  readonlyDirs: Schema.array(Schema.string()).default([]),
  skipMinimalLike: Schema.boolean().default(true),
  requirePromotion: Schema.boolean().default(true)
});
function apply(ctx, config) {
  const entry = resolveEntry(config);
  let readCurrent = () => entry;
  try {
    ctx.inject(["settings"], (scope) => {
      const settings = scope?.settings;
      if (settings === void 0) return;
      const handle = settings.register(SETTINGS_NAMESPACE, Config, {
        base: entry
      });
      readCurrent = () => resolveEntry(handle.get());
    });
  } catch {
  }
  ctx.on("system-prompt/assemble", async (_assembly, context, next) => {
    const assembled = await next();
    try {
      const current = readCurrent();
      if (!shouldParticipate(assembled, context ?? {}, current)) {
        return assembled;
      }
      const sections = buildSections({
        assembled,
        context: context ?? {},
        config: current
      });
      const existing = Array.isArray(assembled.sections) ? assembled.sections : [];
      return { ...assembled, sections: [...existing, ...sections] };
    } catch (error) {
      try {
        ctx.logger?.warn(
          `${name}: section assembly failed; leaving the system prompt untouched`
        );
      } catch {
      }
      void error;
      return assembled;
    }
  });
}
export {
  Config,
  SETTINGS_NAMESPACE,
  apply,
  inject,
  name
};
