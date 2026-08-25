package io.kafbat.ui.config;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import java.util.Map;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.annotation.Validated;

@Configuration
@ConfigurationProperties("cooperative-offset-reset")
@Validated
@Data
public class CooperativeOffsetResetProperties {

  boolean enabled;

  @NotBlank
  String commandTopic = "__kui-cooperative-reset-commands";

  @NotBlank
  String acknowledgementTopic = "__kui-cooperative-reset-acks";

  @NotNull
  Duration timeout = Duration.ofSeconds(30);

  boolean autoCreateTopics;

  @Min(1)
  int topicPartitions = 1;

  Map<String, String> topicProperties = Map.of(
      "cleanup.policy", "delete",
      "retention.ms", String.valueOf(Duration.ofDays(1).toMillis()));

  @AssertTrue(message = "cooperative-offset-reset.timeout must be positive")
  public boolean isTimeoutPositive() {
    return timeout != null && !timeout.isZero() && !timeout.isNegative();
  }
}