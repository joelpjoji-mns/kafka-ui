package io.kafbat.ui.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.google.common.base.Ticker;
import io.kafbat.ui.emitter.Cursor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

class PollingCursorsStorageTest {

  @Test
  void expiresInactiveCursors() {
    var ticker = new MutableTicker();
    var storage = new PollingCursorsStorage(ticker);
    var cursor = new Cursor(null, null, message -> true, 1);
    String cursorId = storage.register(cursor);

    assertThat(storage.getCursor(cursorId)).contains(cursor);

    ticker.advance(PollingCursorsStorage.EXPIRE_AFTER_ACCESS_MINUTES + 1, TimeUnit.MINUTES);

    assertThat(storage.getCursor(cursorId)).isEmpty();
  }

  private static final class MutableTicker extends Ticker {
    private final AtomicLong nanos = new AtomicLong();

    @Override
    public long read() {
      return nanos.get();
    }

    void advance(long duration, TimeUnit unit) {
      nanos.addAndGet(unit.toNanos(duration));
    }
  }
}