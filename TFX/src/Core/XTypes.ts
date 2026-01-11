
import type { XProperty, XPropertyDefault } from "./XProperty.js";

export type XValueChanged = (pProperty: XProperty, pOldValue: unknown, pNewValue: unknown) => void;

export type XOnPropertyChanged = (pSender: unknown, pProperty: XProperty, pValue: unknown) => void;

export type XPropertyDefaultChanged = (pName: string, pSender: XPropertyDefault) => void;

export type XRegisterPropertyLink = (pPropertyId: string) => void;

export type XExternalType = () => XTypeInfo | null;

export type XPropertySelector<T, TType> = (pObj: T) => TType;

export type XPropertySetter<T> = (pObj: T, pValue: unknown) => void;

export type XPersistableElementEvent = (pElement: unknown) => void;

export interface XTypeInfo
{
    Name: string;
    Guid?: string;
}
