// XGuid - GUID utilities
export { XGuid, XGuidFormat } from "./XGuid.js";

// XEvent - Event system
export { XEvent } from "./XEvent.js";

// XDispatcher - Action executor
export { XDispatcher } from "./XDispatcher.js";

// XError - Error handling
export { XError } from "./XError.js";

// XElement - Base element class
export { XElement, XDocumentBase, IsXElement, IsXDocumentBase } from "./XElement.js";
export type { XElementCtor, XElementPredicate } from "./XElement.js";

// XProperty - Property system
export { XProperty, XPropertyDefault, XPersistableElementBase } from "./XProperty.js";

// XValidation - Validation system
export { XConcurrentBag, XDataValidateError, XDesignerErrorSeverity, XValidatableElement } from "./XValidation.js";

// XModelValue - Model values
export { XModelValue, XModelValueElement } from "./XModelValue.js";

// XChangeTracker - Change tracking
export { XChangeTracker, XTrackAction, XTrackableElement } from "./XChangeTracker.js";

// XDefaults - Default values and configuration
export { XDefault, XDesignerDefault, XDefaultIds, XPropertyBinding, XPropertyBindingList } from "./XDefaults.js";

// XConvert - Type conversion utilities
export { XConvert } from "./XConvert.js";

// XData - Data containers
export { XLanguage, XData, XBaseLinkData, XLinkData, XLinkArrayData, XParentData, XValues, XLinkableElement } from "./XData.js";

// XPersistableElement - Main persistable element class
export { XPersistableElement, XSelectionManager, XSelectable, XDesignerDocument, IsXDesignerDocument } from "./XPersistableElement.js";

// XEnums - Enumerations
export { XConstraintType, XPropertyGroup, XPropertyGroupDescription, XElementType } from "./XEnums.js";

// XTypes - Type definitions
export type {
    XValueChanged,
    XOnPropertyChanged,
    XPropertyDefaultChanged,
    XPropertySelector,
    XPropertySetter,
    XRegisterPropertyLink,
    XExternalType,
    XTypeInfo,
    XPersistableElementEvent
} from "./XTypes.js";

// XGeometry - Geometry and visual types
export {
    XAlignment,
    XRectValue,
    XTextAlignment,
    XFontStyle,
    XSize,
    XPoint,
    XThickness,
    XRect,
    XHSLColor,
    XColor,
    XBorderColor,
    XFont
} from "./XGeometry.js";
