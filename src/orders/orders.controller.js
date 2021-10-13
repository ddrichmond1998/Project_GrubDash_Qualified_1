const path = require("path");

// Use the existing order data
const orders = require(path.resolve("src/data/orders-data"));

// Use this function to assign ID's when necessary
const nextId = require("../utils/nextId");

function orderIdExists(req, res, next) {
  const { orderId } = req.params;

  const foundIndex = orders.findIndex((order) => order.id == orderId);
  if (foundIndex >= 0) {
    res.locals.foundOrder = { index: foundIndex, order: orders[foundIndex] };
    next();
  } else {
    return next({
      status: 404,
      message: `Order does not exist: ${orderId}.`,
    });
  }
}

function idMatchesId(req, res, next) {
  const { orderId } = req.params;
  const order = req.body.data;
  if (order.id && orderId !== order.id) {
    return next({
      status: 400,
      message: `Order id does not match route id. Order: ${order.id}, Route: ${orderId}`,
    });
  }
  next();
}

function bodyIsValid(req, res, next) {
  const { orderId } = req.params;
  const order = req.body.data;
  const { deliverTo, mobileNumber, dishes } = order;

  if (!deliverTo) {
    return next({
      status: 400,
      message: "Order must include a deliverTo",
    });
  }
  if (!mobileNumber) {
    return next({
      status: 400,
      message: "Order must include a mobileNumber",
    });
  }

  if (!dishes) {
    return next({
      status: 400,
      message: "Order must include a dish",
    });
  }
  if (!Array.isArray(dishes) || dishes.length === 0) {
    return next({
      status: 400,
      message: "Order must include at least one dish",
    });
  }

  for (let i = 0; i < dishes.length; i++) {
    const dish = dishes[i];
    if (
      !dish.quantity ||
      !Number.isInteger(dish.quantity) ||
      !dish.quantity > 0
    ) {
      return next({
        status: 400,
        message: `Dish ${i} must have a quantity that is an integer greater than 0`,
      });
    }
  }

  let handleId = undefined;
  //  adds new ID when creating new order
  if (req.method === "POST") {
    handleId = { id: nextId() };
  }
  //  doesn't add new id if updating and id not in body
  if (req.method === "PUT") {
    if (!order.id) {
      handleId = { id: orderId };
    } else {
    }
  }

  const newOrder = { ...order, ...handleId };
  res.locals.newOrder = newOrder;
  next();
}

function statusIsValid(req, res, next) {
  const validStatuses = {
    pending: "okToDelete",
    preparing: "x",
    "out-for-delivery": "x",
    delivered: "x",
  };

  if (req.method === "PUT") {
    const order = req.body.data;
    const { status } = order;

    if (!validStatuses[status]) {
      return next({
        status: 400,
        message:
          "Order must have a status of pending, preparing, out-for-delivery, delivered",
      });
    }
    if (res.locals.foundOrder.order.status === "delivered") {
      return next({
        status: 400,
        message: "A delivered order cannot be changed",
      });
    }
  }

  if (req.method === "DELETE") {
    if (validStatuses[res.locals.foundOrder.order.status] !== "okToDelete") {
      return next({
        status: 400,
        message: "An order cannot be deleted unless it is pending",
      });
    }
  }
  next();
}

function read(req, res) {
  res.json({ data: res.locals.foundOrder.order });
}
function update(req, res) {
  const { order } = res.locals.foundOrder;
  const { newOrder } = res.locals;
  // redundant check to make sure  that the id property of the stored data cannot be overwritten.
  if (newOrder.id !== order.id) {
    return next({
      status: 400,
      message: `You can not change existing order id ${order.id} to ${newOrder.id}`,
    });
  }
  const updatedEntry = { ...order, ...newOrder };

  res.json({ data: updatedEntry });
}
function destroy(req, res) {
  const { index } = res.locals.foundOrder;
  const deletedOrder = orders.splice(index, 1);
  console.log("the following was deleted: ", deletedOrder);
  res.sendStatus(204);
}
function list(req, res) {
  res.json({ data: orders });
}
function create(req, res) {
  const { newOrder } = res.locals;
  orders.push(newOrder);
  res.status(201).json({ data: newOrder });
}

module.exports = {
  read: [orderIdExists, read],
  update: [orderIdExists, idMatchesId, bodyIsValid, statusIsValid, update],
  delete: [orderIdExists, statusIsValid, destroy],
  list,
  create: [bodyIsValid, create],
};