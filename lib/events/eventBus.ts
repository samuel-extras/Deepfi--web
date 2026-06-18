export enum EventType {
  BALANCE_UPDATED = "BALANCE_UPDATED",
  ORDERS_UPDATED = "ORDERS_UPDATED",
  ORDER_HISTORY_UPDATED = "ORDER_HISTORY_UPDATED",
  TRADE_HISTORY_UPDATED = "TRADE_HISTORY_UPDATED",
  PORTFOLIO_UPDATED = "PORTFOLIO_UPDATED",
  USER_FEES_UPDATED = "USER_FEES_UPDATED",
  TRANSACTION_HISTORY_UPDATED = "TRANSACTION_HISTORY_UPDATED",
  VAULT_UPDATED = "VAULT_UPDATED",
  PROFILE_UPDATED = "PROFILE_UPDATED",
  PAYOUT_COMPLETED = "PAYOUT_COMPLETED",
}

type EventListener<T = unknown> = (payload?: T) => void;

type UnsubscribeFunction = () => void;

class EventBus {
  private listeners: Map<EventType, Set<EventListener<unknown>>> = new Map();

  on<T = unknown>(
    eventType: EventType,
    listener: EventListener<T>
  ): UnsubscribeFunction {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType)!.add(listener as EventListener<unknown>);

    // Return unsubscribe function
    return () => {
      this.off(eventType, listener as EventListener<unknown>);
    };
  }

  off(eventType: EventType, listener: EventListener<unknown>): void {
    const eventListeners = this.listeners.get(eventType);
    if (eventListeners) {
      eventListeners.delete(listener);

      // Clean up empty sets
      if (eventListeners.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  emit<T = unknown>(eventType: EventType, payload?: T): void {
    const eventListeners = this.listeners.get(eventType);
    if (eventListeners) {
      const listenersCopy = Array.from(eventListeners);
      listenersCopy.forEach(listener => {
        try {
          listener(payload);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  getListenerCount(eventType: EventType): number {
    return this.listeners.get(eventType)?.size || 0;
  }

  clear(eventType: EventType): void {
    this.listeners.delete(eventType);
  }

  clearAll(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();

if (process.env.NODE_ENV === "development") {
  const originalEmit = eventBus.emit.bind(eventBus);
  eventBus.emit = <T = unknown>(eventType: EventType, payload?: T) => {
    const listenerCount = eventBus.getListenerCount(eventType);
    const payloadInfo = payload
      ? ` with payload: ${JSON.stringify(payload)}`
      : "";
    console.log(
      `[EventBus] Emitting ${eventType} to ${listenerCount} listeners${payloadInfo}`
    );
    originalEmit(eventType, payload);
  };
}
