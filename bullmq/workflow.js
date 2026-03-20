import WorkflowAction from "../models/workflows/WorkflowAction.js";
import WorkflowCondition from "../models/workflows/WorkflowCondition.js";
import { delayActionQueue } from "./queue.js";

export async function processWorkflow(workflowData) {
  const { nodes, edges } = workflowData;

  // 1. Find the Trigger
  let currentNode = nodes.find((n) => n.type === "trigger");

  //   2. If no trigger node found, use the first node as the trigger
  //      It means we are executing from delay action worker

  if (!currentNode && nodes.length > 0 && edges.length > 0) {
    console.log("No trigger node found");
    currentNode = nodes[0];
  }

  while (currentNode) {
    console.log(`Executing: ${currentNode.data.label}`);

    // Perform the actual action logic here (e.g., Send Message, Wait, etc.)
    const result = await performNodeAction(currentNode);
    console.log({ currentNode, result });

    // 2. Find the Next Node
    let nextEdge;

    if (currentNode.type === "condition") {
      // Branching logic: result of performNodeAction determines 'true' or 'false'
      const handleToFollow = result ? "true" : "false";
      nextEdge = edges.find(
        (e) => e.source === currentNode.id && e.sourceHandle === handleToFollow,
      );
    } else {
      // Sequential logic: just find the next connected node
      nextEdge = edges.find((e) => e.source === currentNode.id);
    }

    //3. If Delay Action Node
    if (currentNode.type === "action" && currentNode.data.subType === "delay") {
      const actionId = currentNode.data.id;
      const workflowAction = await WorkflowAction.findById(actionId);
      if (!workflowAction) {
        throw new Error(`Action not found: ${actionId}`);
      }
      const delayTime = workflowAction.parameters.delayTime || 0; // Default 1 second
      const delayFormat =
        workflowAction.parameters.delayFormat || "milliseconds";
      const delayInMs = calculateDelayInMs(delayTime, delayFormat);

      console.log({ delayTime, delayFormat, delayInMs });

      const currentNodeIndex = nodes.indexOf(currentNode);
      const currentEdgeIndex = edges.indexOf(nextEdge);

      // Break the rest execution for this sub tree
      const delayActionJob = await delayActionQueue.add(
        "delay",
        {
          ...currentNode.data,
          delayInMs,

          // rest nodes
          nodes: nodes.slice(currentNodeIndex + 1),
          // rest edges
          edges: edges.slice(currentEdgeIndex + 1),
        },
        {
          delay: delayInMs,
          removeOnComplete: true,
        },
      );
      break;
    }

    // 4. Move to the next node or stop if no more edges
    if (nextEdge) {
      currentNode = nodes.find((n) => n.id === nextEdge.target);
    } else {
      currentNode = null; // Workflow finished
    }
  }
}

export const performNodeAction = async (node) => {
  const { type, data } = node;

  switch (type) {
    case "trigger":
      // Handle trigger actions (e.g., start a conversation)
      return await handleTriggerAction(data);
    case "condition":
      // Evaluate condition logic (e.g., check if a field is present)
      return await evaluateCondition(data);
    case "action":
      // Perform an action (e.g., send a message, update a field)
      return await executeAction(data);
    default:
      throw new Error(`Unsupported node type: ${type}`);
  }
};

export const handleTriggerAction = async (triggerData) => {
  const { message, conversationId } = triggerData;
  // Logic to start a conversation or send a message
  return { success: true, message: "Trigger action performed" };
};

export const evaluateCondition = async (conditionData) => {
  const { label, subType, conditionId } = conditionData;
  const workflowCondition = await WorkflowCondition.findById(conditionId);

  if (!workflowCondition) {
    throw new Error(`Condition not found: ${conditionId}`);
  }

  const conditions = workflowCondition.conditions;

  // Evaluate the conditions based on the workflow condition type
  if (workflowCondition.type === "if_else") {
    // For if_else type, we need to evaluate all condition groups
    return evaluateIfElseConditions(conditions);
  } else if (workflowCondition.type === "filter") {
    // For filter type, we might have different logic
    return evaluateFilterConditions(conditions);
  }

  return false;
};

const evaluateIfElseConditions = (conditions) => {
  // For if_else type, we have an array of condition groups
  // Each group has andConditions and orConditions
  for (const conditionGroup of conditions) {
    const { andConditions = [], orConditions = [] } = conditionGroup;

    // Evaluate AND conditions (all must be true)
    const andResult = evaluateAndConditions(andConditions);

    // Evaluate OR conditions (at least one must be true)
    const orResult = evaluateOrConditions(orConditions);

    // If there are both AND and OR conditions, we need to combine them
    // This depends on your business logic. Here's one approach:
    if (andConditions.length > 0 && orConditions.length > 0) {
      // If both exist, both groups must be satisfied
      return andResult && orResult;
    } else if (andConditions.length > 0) {
      // Only AND conditions exist
      return andResult;
    } else if (orConditions.length > 0) {
      // Only OR conditions exist
      return orResult;
    }
  }

  // If no conditions, return false or true based on your requirement
  return false;
};

const evaluateFilterConditions = (conditions) => {
  // For filter type, you might want to evaluate all conditions with AND logic
  // or different logic based on your requirements
  for (const conditionGroup of conditions) {
    const { andConditions = [], orConditions = [] } = conditionGroup;

    // Example: For filter, maybe we want all AND conditions to be true
    // and at least one OR condition to be true
    const andResult = evaluateAndConditions(andConditions);
    const orResult = evaluateOrConditions(orConditions);

    if (andConditions.length > 0 && orConditions.length > 0) {
      return andResult && orResult;
    } else if (andConditions.length > 0) {
      return andResult;
    } else if (orConditions.length > 0) {
      return orResult;
    }
  }

  return false;
};

const evaluateAndConditions = (conditions) => {
  if (conditions.length === 0) return true;

  return conditions.every((condition) => {
    return evaluateSingleCondition(condition);
  });
};

const evaluateOrConditions = (conditions) => {
  if (conditions.length === 0) return false;

  return conditions.some((condition) => {
    return evaluateSingleCondition(condition);
  });
};

const evaluateSingleCondition = (condition) => {
  const { field, operator, value } = condition;

  //   Evaluate the condition based on the field, operator, and value
  //   This is a placeholder for actual evaluation logic
  //   You would need to implement the logic based on your data structure

  /*
    eg: 
    field: "{{lead.age}}"
    operator: "greater_than"
    value: 

    field: "{{lead.email}}"
    operator: "contains"
    value: "@example.com" or it can be any string or a variable
  */

  // Here you would implement the actual evaluation logic
  // based on your field values (this depends on what you're evaluating against)

  switch (operator) {
    case "equal":
      return field === value;

    case "not_equal":
      return field !== value;

    case "contains":
      return field.includes(value);

    case "not_contains":
      return !field.includes(value);

    case "exists":
      return field !== undefined && field !== null;

    case "not_exists":
      return field === undefined || field === null;

    case "is_empty":
      return field === "" || field === null || field === undefined;

    case "is_not_empty":
      return field !== "" && field !== null && field !== undefined;

    case "starts_with":
      return field.startsWith(value);

    case "not_starts_with":
      return !field.startsWith(value);

    case "ends_with":
      return field.endsWith(value);

    case "not_ends_with":
      return !field.endsWith(value);

    case "less_than":
      return field < value;

    case "greater_than":
      return field > value;

    default:
      return false;
  }
};

export const executeAction = async (actionData) => {
  const { type, data } = actionData;
  // Logic to perform the action (e.g., send a message, update a field)
  return { success: true, message: "Action performed" };
};

export const calculateDelayInMs = (delayTime, delayFormat) => {
  if (delayFormat === "seconds") {
    return delayTime * 1000;
  } else if (delayFormat === "minutes") {
    return delayTime * 60 * 1000;
  } else if (delayFormat === "hours") {
    return delayTime * 60 * 60 * 1000;
  } else if (delayFormat === "days") {
    return delayTime * 24 * 60 * 60 * 1000;
  } else {
    return delayTime; // Default to milliseconds
  }
};
