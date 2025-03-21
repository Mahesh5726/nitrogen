import { PrismaClient } from "@prisma/client";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

const prisma = new PrismaClient();
const app = new Hono();


//extra
app.get("/customers", async (context) => {
  const customer = await prisma.customers.findMany();
  return context.json(customer, 200)
})


app.post("/customers", async (context) => {
  const { name, email, phoneNumber, address } = await context.req.json();
  try {
    const existEmail = await prisma.customers.findUnique({ where: { email } });
    const existPhoneNumber = await prisma.customers.findUnique({
      where: { phoneNumber },
    });

    if (existEmail || existPhoneNumber) {
      return context.json(
        { message: "Email or phone number already exist" },
        404
      );
    }

    const customer = await prisma.customers.create({
      data: {
        name: name,
        email: email,
        phoneNumber: phoneNumber,
        address: address,
      },
    });

    return context.json(customer, 201);
  } catch (error) {
    console.error("Error creating customer", error);
    return context.json({ message: "Error creating customer" }, 500);
  }
});

app.get("/customers/top", async (context) => {
  try {
    const topCustomers = await prisma.orders.groupBy({
      by: ["customerId"],
      _count: {
        customerId: true,
      },
      orderBy: {
        _count: {
          customerId: "desc",
        },
      },
      take: 5,
    });

    if (topCustomers.length === 0) {
      return context.json({ message: "No customers found" }, 404);
    }

    const customers = [];
    for (const item of topCustomers) {
      const customer = await prisma.customers.findUnique({
        where: { id: item.customerId }
      });
      if (customer) {
        customers.push(customer);
      }
    }

    return context.json(customers, 200);
  } catch (error) {
    console.error("Error retrieving top customers", error);
    return context.json({ message: "Error retrieving top customers" }, 500);
  }
});

app.get("/customers/:id", async (context) => {
  const { id } = context.req.param();
  try {
    const customer = await prisma.customers.findUnique({ where: { id } });
    if (!customer) {
      return context.json({ message: "Customer not found" }, 404);
    }
    return context.json(customer);
  } catch (error) {
    console.error("No customer data found", error);
    return context.json({ message: "No customer Data Found" }, 404);
  }
});

app.post("/restaurants", async (context) => {
  const { name, location } = await context.req.json();
  try {
    const existName = await prisma.restaurants.findUnique({ where: { name } });
    if (existName) {
      return context.json({ message: "Restaurant name already exist" }, 404);
    }
    const restaurant = await prisma.restaurants.create({
      data: {
        name: name,
        location: location,
      },
    });
    return context.json(restaurant, 201);
  } catch (error) {
    console.error("Error creating a restaurant", error);
    return context.json({ message: "Error creating a restaurant" }, 500);
  }
});

//extra
app.get("/restaurants", async (context) => {
  const rest = await prisma.restaurants.findMany();
  return context.json(rest, 200)
})

app.post("/restaurants/:id/menu", async (context) => {
  const { id } = context.req.param();
  const { name, price } = await context.req.json();
  try {
    const existRestaurant = await prisma.restaurants.findUnique({
      where: {
        id: id,
      },
    });
    if (!existRestaurant) {
      return context.json({ message: "Restaurant not found" }, 404);
    }

    const menu = await prisma.menuItems.create({
      data: {
        name: name,
        price: price,
        restaurantId: id,
      },
    });
    return context.json(menu, 201);
  } catch (error) {
    console.error("Error finding restaurant", error);
    return context.json({ message: "Error finding restaurant" }, 404);
  }
});

app.get("/restaurants/:id/menu", async (context) => {
  const { id } = context.req.param();
  try {
    const restaurant = await prisma.restaurants.findUnique({
      where: { id },
    });
    if (!restaurant) {
      return context.json({ message: "Restaurant not found" }, 404);
    }

    const menuItems = await prisma.menuItems.findMany({
      where: { restaurantId: id },
    });
    if (menuItems.length === 0) {
      return context.json(
        { message: "No menu items found for this restaurant" },
        404
      );
    }

    return context.json(
      {
        restaurantName: restaurant.name,
        menuItems: menuItems,
      },
      200
    );
  } catch (error) {
    console.error("Error fetching menu items", error);
    return context.json({ message: "Error fetching menu items" }, 500);
  }
});

app.patch("/menu/:id", async (context) => {
  const { id } = context.req.param();
  const { price, isAvailable } = await context.req.json();
  try {
    const menuItem = await prisma.menuItems.findUnique({ where: { id } });
    if (!menuItem) {
      return context.json({ message: "Menu item not found" }, 404);
    }

    const updateMenuItem = await prisma.menuItems.update({
      where: {
        id,
      },
      data: {
        price: price,
        isAvailable: isAvailable,
      },
    });
    return context.json({ message: "Menu item updated", updateMenuItem }, 200);
  } catch (error) {
    console.error("Unable to update menu item", error);
    return context.json({ message: "Unable to update menu item" }, 500);
  }
});


app.post("/orders", async (c) => {
  const { customerId, restaurantId, items } = await c.req.json();
  try {
        const customer = await prisma.customers.findUnique({
      where: { id: customerId },
    });
    const restaurant = await prisma.restaurants.findUnique({
      where: { id: restaurantId },
    });

    if (!customer) {
      return c.json({ message: "Customer does not exist" }, 400);
    }
    if (!restaurant) {
      return c.json({ message: "Restaurant does not exist" }, 400);
    }

    const order = await prisma.orders.create({
      data: {
        customerId,
        restaurantId,
        totalPrice: 0,
      },
    });

    let totalPrice = 0;

    for (const item of items) {
      const menuItem = await prisma.menuItems.findUnique({
        where: { id: item.menuItemId },
      });

      if (!menuItem || !menuItem.isAvailable) {
        return c.json(
          {
            message: `Menu item ID ${item.menuItemId} not found or unavailable`,
          },
          400
        );
      }

      // Calculate the total price for the current menu item
      const itemTotal = Number(menuItem.price) * item.quantity;
      totalPrice += itemTotal;

      
      await prisma.orderItems.create({
        data: {
          orderId: order.id,
          menuItemId: menuItem.id,
          quantity: item.quantity,
        },
      });
    }

    // Update totalprice
    const updatedOrder = await prisma.orders.update({
      where: { id: order.id },
      data: {
        totalPrice: totalPrice,
      },
    });

    return c.json({ message: updatedOrder }, 201);
  } catch (error) {
    console.error("Error placing order:", error);
    return c.json({ message: "Failed to place order" }, 500);
  }
});

app.get("/orders/:id", async (context) => {
  const { id } = context.req.param();
  try {
    const order = await prisma.orders.findUnique({
      where: { id },
      include: {
        customer: true,
        restaurant: true,
        OrderItems: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    if (!order) {
      return context.json({ message: "Order not found" }, 404);
    }

    return context.json(order, 200);
  } catch (error) {
    console.error("Error retrieving order", error);
    return context.json({ message: "Error retrieving order" }, 500);
  }
});

app.patch("/orders/:id/status", async (context) => {
  const { id } = context.req.param();
  const { status } = await context.req.json();
  try {
    const order = await prisma.orders.findUnique({ where: { id } });

    if (!order) {
      return context.json({ message: "Order not found" }, 404);
    }

    const updatedOrder = await prisma.orders.update({
      where: { id },
      data: { status },
    });

    return context.json({ message: "Order status updated", updatedOrder }, 200);
  } catch (error) {
    console.error("Error updating order status", error);
    return context.json({ message: "Error updating order status" }, 500);
  }
});

app.get("/restaurants/:id/revenue", async (context) => {
  const { id } = context.req.param();
  try {
    // Check if the restaurant exists
    const restaurant = await prisma.restaurants.findUnique({
      where: { id },
    });

    if (!restaurant) {
      return context.json({ message: "Restaurant not found" }, 404);
    }

    // Calculate the total revenue generated by the restaurant
    const orders = await prisma.orders.findMany({
      where: { restaurantId: id },
    });

    const totalRevenue = orders.reduce(
      (acc, order) => acc + Number(order.totalPrice),
      0
    );

    return context.json({ restaurantName: restaurant.name, totalRevenue }, 200);
  } catch (error) {
    console.error("Error calculating revenue", error);
    return context.json({ message: "Error calculating revenue" }, 500);
  }
});

app.get("/menu/top-items", async (context) => {
  try {
    const topItems = await prisma.orderItems.groupBy({
      by: ["menuItemId"],
      _count: {
        menuItemId: true,
      },
      orderBy: {
        _count: {
          menuItemId: "desc",
        },
      },
      take: 1, 
    });

    if (topItems.length === 0) {
      return context.json({ message: "No menu items found" }, 404);
    }

    const topMenuItem = await prisma.menuItems.findUnique({
      where: { id: topItems[0].menuItemId },
    });

    return context.json(topMenuItem, 200);
  } catch (error) {
    console.error("Error retrieving top menu item", error);
    return context.json({ message: "Error retrieving top menu item" }, 500);
  }
});


app.get("/customers/:id/orders", async (context) => {
  const id = context.req.param("id");
  try {
    // Check if the customer exists
    const customer = await prisma.customers.findUnique({
      where: { id },
    });

    if (!customer) {
      return context.json({ message: "Customer not found" }, 404);
    }

    // Retrieve all orders placed by the customer
    const orders = await prisma.orders.findMany({
      where: { customerId: id },
      include: {
        restaurant: true,
        OrderItems: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    return context.json(orders, 200);
  } catch (error) {
    console.error("Error retrieving orders", error);
    return context.json({ message: "Error retrieving orders" }, 500);
  }
});



serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
