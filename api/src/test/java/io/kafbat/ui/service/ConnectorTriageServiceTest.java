package io.kafbat.ui.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.kafbat.ui.model.ConnectorDTO;
import io.kafbat.ui.model.ConnectorStateDTO;
import io.kafbat.ui.model.ConnectorStatusDTO;
import io.kafbat.ui.model.ConnectorTaskStatusDTO;
import io.kafbat.ui.model.TaskDTO;
import io.kafbat.ui.model.TaskIdDTO;
import io.kafbat.ui.model.TaskStatusDTO;
import io.kafbat.ui.model.connect.InternalConnectorInfo;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class ConnectorTriageServiceTest {

  @Test
  void projectsCriticalTaskFailuresWarningsAndHealthyConnectors() {
    ConnectorTriageService service = new ConnectorTriageService(
        Mockito.mock(KafkaConnectService.class));

    var critical = service.toTriageConnector(connector(
        "orders-sink",
        ConnectorStateDTO.TASK_FAILED,
        "connector failed after retries",
        List.of(task(3, ConnectorTaskStatusDTO.FAILED, "task exception"))));
    var warning = service.toTriageConnector(connector(
        "payments-source",
        ConnectorStateDTO.RESTARTING,
        null,
        List.of()));
    var healthy = service.toTriageConnector(connector(
        "inventory-sink",
        ConnectorStateDTO.RUNNING,
        null,
        List.of(task(0, ConnectorTaskStatusDTO.RUNNING, null))));

    var snapshot = service.snapshot(List.of(critical, warning, healthy));

    assertThat(critical.getSeverity().name()).isEqualTo("CRITICAL");
    assertThat(critical.getFailedTasksCount()).isEqualTo(1);
    assertThat(critical.getFailedTasks())
        .singleElement()
        .satisfies(task -> {
          assertThat(task.getId()).isEqualTo(3);
          assertThat(task.getTraceExcerpt()).isEqualTo("task exception");
        });
    assertThat(snapshot.getSummary().getTotalConnectors()).isEqualTo(3);
    assertThat(snapshot.getSummary().getCriticalConnectors()).isEqualTo(1);
    assertThat(snapshot.getSummary().getWarningConnectors()).isEqualTo(1);
    assertThat(snapshot.getSummary().getHealthyConnectors()).isEqualTo(1);
    assertThat(snapshot.getSummary().getFailedTasks()).isEqualTo(1);
  }

  private InternalConnectorInfo connector(String name,
                                          ConnectorStateDTO state,
                                          String trace,
                                          List<TaskDTO> tasks) {
    return InternalConnectorInfo.builder()
        .connector(new ConnectorDTO()
            .connect("connect-a")
            .name(name)
            .status(new ConnectorStatusDTO().state(state).trace(trace)))
        .tasks(tasks)
        .build();
  }

  private TaskDTO task(int id, ConnectorTaskStatusDTO state, String trace) {
    return new TaskDTO()
        .id(new TaskIdDTO().connector("connector").task(id))
        .status(new TaskStatusDTO().id(id).state(state).workerId("worker").trace(trace));
  }
}