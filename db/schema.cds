namespace mcp.server;

entity Products {
    key ID : String(36);
    name : String(100);
    price : Decimal(10,2);
    stock : Integer;
    category : String(50);
}

entity Orders {
    key ID : String(36);
    orderDate : DateTime;
    customerName : String(100);
    totalAmount : Decimal(10,2);
    status : String(20);
}