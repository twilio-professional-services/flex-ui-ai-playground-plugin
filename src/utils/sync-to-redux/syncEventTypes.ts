/**
 * Type definitions for Twilio Sync event payloads
 */

/**
 * Sync Map item structure
 */
export interface SyncMapItem<T = unknown> {
  key: string;
  value?: T;
  data: T;
  dateCreated: Date;
  dateUpdated: Date;
  dateExpires?: Date;
}

/**
 * Sync Map itemAdded event payload
 */
export interface SyncMapItemAddedEvent<T = unknown> {
  item: SyncMapItem<T>;
  isLocal: boolean;
}

/**
 * Sync Map itemUpdated event payload
 */
export interface SyncMapItemUpdatedEvent<T = unknown> {
  item: SyncMapItem<T>;
  previousItemData: T;
  isLocal: boolean;
}

/**
 * Sync Map itemRemoved event payload
 */
export interface SyncMapItemRemovedEvent {
  key: string;
  previousItemData: unknown;
  isLocal: boolean;
}

/**
 * Sync Document updated event payload
 */
export interface SyncDocumentUpdatedEvent<T = unknown> {
  data: T;
  previousData: T;
  isLocal: boolean;
}

/**
 * Sync List item structure
 */
export interface SyncListItem<T = unknown> {
  index: number;
  data: T;
  dateCreated: Date;
  dateUpdated: Date;
}

/**
 * Sync List itemAdded event payload
 */
export interface SyncListItemAddedEvent<T = unknown> {
  item: SyncListItem<T>;
  isLocal: boolean;
}

/**
 * Sync List itemUpdated event payload
 */
export interface SyncListItemUpdatedEvent<T = unknown> {
  item: SyncListItem<T>;
  previousItemData: T;
  isLocal: boolean;
}

/**
 * Sync List itemRemoved event payload
 */
export interface SyncListItemRemovedEvent {
  index: number;
  previousItemData: unknown;
  isLocal: boolean;
}

/**
 * Token updated event from Flex Manager
 */
export interface TokenUpdatedEvent {
  token: string;
}
